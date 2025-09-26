import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { nameRules, phoneRules, addressRules } from '../utils/validation.js';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatKES } from '../utils/currency.js';
import QRCode from 'qrcode';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
// Attach virtual file system fonts (handles different export shapes)
pdfMake.vfs = (pdfFonts?.pdfMake?.vfs) || pdfFonts.vfs || pdfMake.vfs;
import ProgressSteps from '../components/ProgressSteps.jsx';
import { generateOrderRef, sendEmailMock } from '../services/orderService.js';
import { useMobileMoneyPayment } from '../hooks/useMobileMoneyPayment.js';
import PaymentOptionModal from '../components/PaymentOptionModal.jsx';
import { paymentBranding, api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { appendGuestOrder, ensureGuestSessionId } from '../utils/guestOrders.js';

function buildCartSignature(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  return [...list]
    .map(item => `${item.id}:${item.qty}`)
    .sort()
    .join('|');
}

export default function Checkout() {
  const { user: authUser } = useAuth();
  const guestSessionId = ensureGuestSessionId();
  const { items, total, clearCart, backupCart, restoreCart, clearCartBackup, hasCartBackup } = useCart();
  const VAT_RATE = 0.16; // 16% VAT (prices assumed VAT-inclusive)
  const { push } = useToast();
  const navigate = useNavigate();

  const persisted = (() => {
    let raw = {};
    try { raw = JSON.parse(sessionStorage.getItem('checkout') || '{}'); } catch { raw = {}; }
    const snapshot = raw?.orderSnapshot;
    const snapshotStatus = typeof snapshot?.paymentStatus === 'string' ? snapshot.paymentStatus.toUpperCase() : null;
    const pendingStatuses = new Set(['PENDING','INITIATED','PROCESSING']);
    const hasPendingPayment = snapshotStatus ? pendingStatuses.has(snapshotStatus) : false;
    const hasSnapshotItems = Array.isArray(snapshot?.items) && snapshot.items.length > 0;
    const stepNumber = Number(raw?.step) || 1;
    const submittedFlag = Boolean(raw?.submitted);
    const isStale = submittedFlag
      || (stepNumber >= 2 && !hasPendingPayment)
      || (stepNumber >= 2 && !hasSnapshotItems);
    if (isStale) {
      try { sessionStorage.removeItem('checkout'); } catch {}
      return {};
    }
    return raw || {};
  })();
  // react-hook-form integration for step 1 (customer details)
  const defaultValues = {
    name: persisted.form?.name || '',
    phone: persisted.form?.phone || '',
    delivery: persisted.form?.delivery || 'pickup',
    address: persisted.form?.address || ''
  };
  const { register, handleSubmit, watch, trigger, setValue, formState: { errors, touchedFields } } = useForm({
    mode: 'onBlur',
    defaultValues
  });
  const form = watch();
  const [submitted, setSubmitted] = useState(persisted.submitted || false);
  const [orderSnapshot, setOrderSnapshot] = useState(() => persisted.orderSnapshot || null);
  const [step, setStep] = useState(persisted.step || 1); // 1: details, 2: payment, 3: confirm
  // removed manual errors / touched state (handled by react-hook-form)
  const [payMethod, setPayMethod] = useState(persisted.payMethod || 'mobile-money');
  const [paymentRef, setPaymentRef] = useState('');
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const mm = useMobileMoneyPayment();
  const orderRef = useState(() => persisted.orderRef || generateOrderRef())[0];

  const [paymentOptions, setPaymentOptions] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [modalPhone, setModalPhone] = useState(form.phone || '');
  const [modalAccountRef, setModalAccountRef] = useState('');
  const [optionsLoading, setOptionsLoading] = useState(false);

  const hasResumableOrder = Boolean(
    submitted ||
    step >= 2 ||
    (orderSnapshot && Array.isArray(orderSnapshot.items) && orderSnapshot.items.length > 0) ||
    (persisted && persisted.orderSnapshot && Array.isArray(persisted.orderSnapshot.items) && persisted.orderSnapshot.items.length > 0)
  );
  const shouldRedirectToCart = items.length === 0 && !hasResumableOrder;

  useEffect(() => {
    if (shouldRedirectToCart) {
      try { sessionStorage.removeItem('checkout'); } catch {}
      setModalOpen(false);
    }
  }, [shouldRedirectToCart]);

  const effectivePaymentStatus = mm.payment?.status ?? orderSnapshot?.paymentStatus ?? null;
  const modalPaymentState = (() => {
    if (mm.status && mm.status !== 'idle') return mm.status;
    if (!effectivePaymentStatus) return mm.status;
    if (effectivePaymentStatus === 'SUCCESS') return 'succeeded';
    if (effectivePaymentStatus === 'FAILED') return 'failed';
    return 'pending';
  })();
  const liveCartTotal = Number.isFinite(Number(total)) ? Number(total) : 0;
  const snapshotTotal = Number.isFinite(Number(orderSnapshot?.total)) ? Number(orderSnapshot.total) : liveCartTotal;
  const formattedSnapshotTotal = snapshotTotal.toFixed(2);

  const PAYMENT_LABELS = {
    'mobile-money': 'Mobile Money',
    cash: 'Cash on Delivery',
    card: 'Card'
  };

  const formatPaymentMethod = (value, fallback = null) => {
    let resolved = value;
    if (!resolved && fallback) resolved = fallback;
    if (!resolved) return 'Payment';
    const normalized = resolved.toString();
    const upper = normalized.toUpperCase();
    switch (upper) {
      case 'MPESA':
        return 'M-Pesa';
      case 'AIRTEL':
      case 'AIRTEL_MONEY':
        return 'Airtel Money';
      case 'MOBILE_MONEY':
        return 'Mobile Money';
      case 'CASH_ON_DELIVERY':
      case 'COD':
        return 'Cash on Delivery';
      case 'CARD':
      case 'CREDIT_CARD':
      case 'DEBIT_CARD':
        return 'Card';
      default:
        if (PAYMENT_LABELS[normalized]) return PAYMENT_LABELS[normalized];
        return normalized
          .replace(/[_-]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  const resolvedPaymentProvider = orderSnapshot?.paymentProgress?.provider
    ?? mm.payment?.provider
    ?? selectedOption?.provider
    ?? null;

  const resolvedPaymentChannel = orderSnapshot?.paymentProgress?.channel
    ?? mm.payment?.channel
    ?? selectedOption?.channel
    ?? (resolvedPaymentProvider === 'MPESA'
      ? 'MPESA_STK_PUSH'
      : resolvedPaymentProvider === 'AIRTEL'
        ? 'AIRTEL_STK_PUSH'
        : null);

  const resolvedPaymentMethodCode = (() => {
    if (orderSnapshot?.paymentMethod) return orderSnapshot.paymentMethod;
    if (orderSnapshot?.paymentProgress?.method) return orderSnapshot.paymentProgress.method;
    if (mm.payment?.method) return mm.payment.method;
    switch (payMethod) {
      case 'cash':
        return 'CASH_ON_DELIVERY';
      case 'card':
        return 'CARD';
      case 'mobile-money':
        return resolvedPaymentProvider ?? 'MOBILE_MONEY';
      default:
        return payMethod || null;
    }
  })();

  const resolvedPaymentLabel = formatPaymentMethod(
    resolvedPaymentProvider ?? resolvedPaymentMethodCode ?? payMethod,
    resolvedPaymentMethodCode
  );

  const handlePayMethodChange = (value) => {
    setPayMethod(value);
    persist({ payMethod: value });
    if (value !== 'mobile-money') {
      setSelectedOption(null);
      setModalOpen(false);
    }
  };

  const parseMoney = (value) => {
    if (value == null) return null;
    if (typeof value === 'object') {
      if (value.amount != null) return parseMoney(value.amount);
      if (value.value != null) return parseMoney(value.value);
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const roundCurrency = (value) => {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  };

  function summarizeInstructions(md) {
    if (!md) return '';
    try {
      const first = (md.split('\n').find(l => l.trim().length>0) || '').trim();
      if (!first) return '';
      // strip very basic markdown: **bold**, *italics*, `code`
      return first
        .replace(/\*\*(.+?)\*\*/g,'$1')
        .replace(/\*(.+?)\*/g,'$1')
        .replace(/`(.+?)`/g,'$1');
    } catch { return ''; }
  }

  function persist(partial) {
    const data = {
      form,
      step,
      submitted,
      payMethod,
      orderRef,
      orderSnapshot,
      ...partial
    };
    try { sessionStorage.setItem('checkout', JSON.stringify(data)); } catch {}
  }

  // persist whenever core state changes
  useEffect(() => { persist({}); }, [form, step, submitted, payMethod]);

  // address requirement depends on delivery method; trigger validation when delivery changes
  useEffect(() => {
    if (form.delivery !== 'delivery') {
      setValue('address', '');
    }
    trigger('address');
  }, [form.delivery, setValue, trigger]);

  // react-hook-form handles validation; trigger() used before advancing

  // focus management - focus heading when step changes
  const headingRef = useState(null)[0];
  useEffect(() => {
    const h = document.getElementById('checkout-heading');
    if (h) h.focus();
  }, [step]);

  const onSubmitDetails = () => {
    setStep(2);
    push('Details accepted');
  };

  async function initiateMobileMoneyReal() {
    if (['initiating','pending','reconciling'].includes(mm.status)) {
      push('Payment already in progress. Please wait for confirmation before starting another.', 'warning');
      setModalOpen(true);
      return;
    }
    if (orderSnapshot?.backendOrderId && ['INITIATED','PENDING'].includes(orderSnapshot?.paymentStatus ?? '')) {
      push('An order payment is already in progress. Please wait for confirmation or restart checkout to create a new order.', 'warning');
      setModalOpen(true);
      return;
    }
    try {
      const provider = payMethod === 'mpesa' ? 'MPESA' : 'AIRTEL';
      const channel = payMethod === 'mpesa' ? 'MPESA_STK_PUSH' : 'AIRTEL_STK_PUSH';
      const payload = {
        orderId: orderSnapshot?.backendOrderId || orderSnapshot?.tempOrderId,
        provider,
        channel,
        method: 'MOBILE_MONEY',
        amount: formattedSnapshotTotal,
        phoneNumber: form.phone
      };
      // Ensure order exists in backend before payment (create if not already saved)
      let backendOrderId = orderSnapshot?.backendOrderId;
      const snapshotUserId = orderSnapshot?.userId ?? null;
      const currentUserId = authUser?.id ?? null;
      if (backendOrderId && snapshotUserId !== currentUserId) {
        backendOrderId = null;
        setOrderSnapshot(null);
        persist({ orderSnapshot: null });
      }
      if (!backendOrderId) {
        const created = await ensureBackendOrder();
        if (!created) return; // error already surfaced
        backendOrderId = created.id;
        payload.orderId = backendOrderId;
      } else {
        payload.orderId = backendOrderId;
      }
      const initiated = await mm.initiate(payload);
      setPaymentRef(initiated.externalRequestId || initiated.id);
    } catch (e) {
      push(e.message || 'Payment initiation failed', 'error');
    }
  }

  async function ensureBackendOrder() {
    try {
      const created = await api.orders.create({
        customerName: form.name,
        customerPhone: form.phone,
        items: items.map(i => ({ productId: i.id, quantity: i.qty }))
      });
      // Create a snapshot of the current cart for display and receipts before clearing
      const cartSig = buildCartSignature(items);
      const backendSubtotal = parseMoney(created?.totalNet ?? created?.subtotal ?? created?.netTotal);
      const backendVat = parseMoney(created?.vatAmount ?? created?.vat ?? created?.taxAmount);
      const backendTotal = parseMoney(created?.totalGross ?? created?.total ?? created?.totalAmount);

      const computedVat = roundCurrency(liveCartTotal - (liveCartTotal / (1 + VAT_RATE)));
      const fallbackVat = computedVat ?? 0;
      const computedNet = roundCurrency(liveCartTotal - fallbackVat);
      const fallbackNet = computedNet ?? liveCartTotal;

      const snapshotItems = Array.isArray(created?.items) && created.items.length > 0
        ? created.items.map((item, idx) => {
            const fallbackSource = items[idx];
            const product = item.product || {};
            const qtyRaw = item.quantity ?? item.qty ?? fallbackSource?.qty ?? 0;
            const qty = Number.isFinite(Number(qtyRaw)) ? Number(qtyRaw) : 0;
            const lineGross = parseMoney(item.totalGross ?? item.lineTotal ?? item.totalAmount ?? item.total);
            const unitGross = parseMoney(item.unitPriceGross ?? item.price ?? item.unitPrice);
            const fallbackUnit = parseMoney(fallbackSource?.price);
            const resolvedUnit = unitGross != null ? unitGross : (qty > 0 && lineGross != null ? lineGross / qty : fallbackUnit);
            const productId = product.id ?? item.productId ?? fallbackSource?.id ?? item.id ?? idx;
            const label = (product.name ?? item.productName ?? item.name ?? fallbackSource?.name ?? `Item ${productId}`).toString();
            const roundedUnit = roundCurrency(resolvedUnit) ?? fallbackUnit ?? 0;
            return { id: productId, name: label, price: roundedUnit, qty };
          })
        : items.map(i => {
            const qty = Number.isFinite(Number(i.qty)) ? Number(i.qty) : 0;
            const price = parseMoney(i.price) ?? 0;
            return { id: i.id, name: i.name, price: roundCurrency(price) ?? price, qty };
          });

      const resolvedSubtotal = roundCurrency(backendSubtotal ?? fallbackNet) ?? fallbackNet;
      const resolvedVat = roundCurrency(backendVat ?? fallbackVat) ?? fallbackVat;
      const resolvedTotal = roundCurrency(backendTotal ?? liveCartTotal) ?? liveCartTotal;
      const snapshotUserId = created?.user?.id ?? created?.user_id ?? (authUser?.id ?? null);
      const snapshot = {
        items: snapshotItems,
        subtotal: resolvedSubtotal,
        vat: resolvedVat,
        total: resolvedTotal,
        ts: Date.now(),
        backendOrderId: created.id,
        cartSignature: cartSig,
        userId: snapshotUserId,
        paymentStatus: created?.latestPayment?.status ?? created?.paymentStatus ?? null,
        paymentMethod: created?.latestPayment?.method ?? created?.paymentMethod ?? null
      };
      setOrderSnapshot(snapshot);
      persist({ orderSnapshot: snapshot });

      // Soft-clear cart after successful order creation with a backup for safety
      if (!hasCartBackup) {
        try { backupCart(); } catch {}
      }
      clearCart();
      return created;
    } catch (e) {
      // Extract probable root cause keywords to show friendlier text
      const msg = (e.message || '').toLowerCase();
      let friendly = 'Could not create order.';
      if (msg.includes('insufficient stock')) friendly = 'Some items are out of stock. Please adjust quantities.';
      else if (msg.includes('product not found')) friendly = 'One of the products was removed. Refresh and try again.';
      else if (msg.includes('at least one item')) friendly = 'Your cart is empty.';
      push(friendly, 'error');
      return null;
    }
  }

  // React to successful payment completion
  useEffect(() => {
    if (mm.payment) {
      setOrderSnapshot(os => {
        if (!os) return os;
        const next = { ...os, paymentStatus: mm.payment.status ?? null, paymentMethod: mm.payment.method ?? os.paymentMethod ?? null };
        persist({ orderSnapshot: next });
        return next;
      });
    }
  }, [mm.payment]);

  useEffect(() => {
    if (mm.status === 'succeeded' && !submitted) {
      // Prefer existing snapshot captured at order creation; fallback to live cart
      let snapshot = orderSnapshot;
      const paymentAmount = parseMoney(mm.payment?.amount);
      if (!snapshot) {
        const baseTotal = paymentAmount ?? liveCartTotal;
        const normalizedTotal = roundCurrency(baseTotal) ?? baseTotal;
        const vatPortion = roundCurrency(normalizedTotal - (normalizedTotal / (1 + VAT_RATE))) ?? 0;
        const net = roundCurrency(normalizedTotal - vatPortion) ?? normalizedTotal;
        snapshot = {
          items: items.map(i => {
            const qty = Number.isFinite(Number(i.qty)) ? Number(i.qty) : 0;
            const price = parseMoney(i.price) ?? 0;
            return { id: i.id, name: i.name, price: roundCurrency(price) ?? price, qty };
          }),
          subtotal: net,
          vat: vatPortion,
          total: normalizedTotal,
          ts: Date.now(),
          cartSignature: buildCartSignature(items),
          userId: authUser?.id ?? null,
          paymentStatus: mm.payment?.status ?? 'SUCCESS',
          paymentMethod: mm.payment?.method ?? null
        };
        setOrderSnapshot(snapshot);
      } else {
        const normalizedTotal = roundCurrency(paymentAmount ?? snapshot.total ?? liveCartTotal) ?? snapshot.total ?? liveCartTotal;
        const normalizedSubtotal = snapshot.subtotal != null ? roundCurrency(snapshot.subtotal) ?? snapshot.subtotal : snapshot.subtotal;
        const normalizedVat = snapshot.vat != null ? roundCurrency(snapshot.vat) ?? snapshot.vat : snapshot.vat;
        snapshot = {
          ...snapshot,
          total: normalizedTotal,
          subtotal: normalizedSubtotal ?? snapshot.subtotal,
          vat: normalizedVat ?? snapshot.vat,
          paymentStatus: mm.payment?.status ?? snapshot.paymentStatus ?? 'SUCCESS',
          paymentMethod: mm.payment?.method ?? snapshot.paymentMethod ?? null
        };
        setOrderSnapshot(snapshot);
      }
      setStep(3);
      setSubmitted(true);
      persist({ submitted: true, step: 3, paymentRef, orderSnapshot: snapshot });
      // Clear any cart backup since the order/payment is complete
      try { clearCart(); } catch {}
      try { clearCartBackup(); } catch {}
      push('Payment successful');
      setModalOpen(false);
      // store order history
      try {
        const itemsForStorage = (Array.isArray(snapshot.items) ? snapshot.items : items).map((i, idx) => {
          const qty = Number.isFinite(Number(i.qty)) ? Number(i.qty) : 0;
          const price = parseMoney(i.price) ?? 0;
          const unitGross = roundCurrency(price) ?? price;
          const unitNet = roundCurrency(unitGross / (1 + VAT_RATE)) ?? unitGross;
          const unitVat = roundCurrency(unitGross - unitNet) ?? 0;
          return {
            id: i.id ?? idx,
            productId: i.id ?? idx,
            productName: i.name ?? `Item ${idx + 1}`,
            quantity: qty,
            unitPriceGross: unitGross,
            unitPriceNet: unitNet,
            vatAmount: unitVat
          };
        });
        const isoCreatedAt = new Date(snapshot.ts || Date.now()).toISOString();
        const fallbackMethodCode = (() => {
          if (snapshot.paymentMethod) return snapshot.paymentMethod;
          if (mm.payment?.method) return mm.payment.method;
          switch (payMethod) {
            case 'cash':
              return 'CASH_ON_DELIVERY';
            case 'card':
              return 'CARD';
            default:
              return 'MOBILE_MONEY';
          }
        })();
        const fallbackProvider = snapshot.paymentProgress?.provider
          ?? mm.payment?.provider
          ?? resolvedPaymentProvider
          ?? (fallbackMethodCode === 'MOBILE_MONEY' ? 'MPESA' : null);
        const fallbackChannel = snapshot.paymentProgress?.channel
          ?? mm.payment?.channel
          ?? resolvedPaymentChannel
          ?? (fallbackProvider === 'MPESA'
            ? 'MPESA_STK_PUSH'
            : fallbackProvider === 'AIRTEL'
              ? 'AIRTEL_STK_PUSH'
              : null);
        const guestOrder = {
          id: snapshot.backendOrderId ?? orderSnapshot?.backendOrderId ?? `guest-${orderRef}`,
          sessionId: guestSessionId,
          orderRef,
          createdAt: isoCreatedAt,
          customerName: form.name,
          customerPhone: form.phone,
          items: itemsForStorage,
          totalGross: snapshot.total,
          totalNet: snapshot.subtotal ?? roundCurrency(snapshot.total / (1 + VAT_RATE)) ?? snapshot.total,
          vatAmount: snapshot.vat ?? roundCurrency(snapshot.total - (snapshot.subtotal ?? (snapshot.total / (1 + VAT_RATE)))) ?? 0,
          paymentStatus: snapshot.paymentStatus ?? 'SUCCESS',
          paymentMethod: fallbackMethodCode,
          paymentProgress: snapshot.paymentStatus ? {
            status: snapshot.paymentStatus,
            method: fallbackMethodCode,
            provider: fallbackProvider,
            channel: fallbackChannel,
            amount: snapshot.total,
            updatedAt: isoCreatedAt,
          } : null,
          snapshot,
          guestPaymentRef: paymentRef || null,
          guestPaymentMethod: payMethod,
        };
        appendGuestOrder(guestOrder, guestSessionId);
        try { localStorage.removeItem('orders'); } catch {}
      } catch {}
    }
    if (mm.status === 'failed' || mm.status === 'timeout') {
      const timedOut = mm.payment?.failureReason === 'TIMEOUT_EXPIRED' || mm.status === 'timeout';
      if (orderSnapshot?.backendOrderId) {
        (async () => {
          try {
            await api.payments.markFailed(orderSnapshot.backendOrderId, {
              reason: timedOut ? 'TIMEOUT_EXPIRED' : 'PAYMENT_FAILED',
              context: {
                hookStatus: mm.status,
                failureReason: mm.payment?.failureReason ?? null
              }
            });
          } catch (err) {
            console.warn('Failed to notify backend about order failure', err);
          }
        })();
      }
      push(timedOut ? 'Payment attempt expired after 3 minutes. If your mobile money was charged, please contact support.' : 'Payment failed', timedOut ? 'warning' : 'error');
      // Automatically restore cart on failure if we have a backup
      try {
        if (hasCartBackup) {
          restoreCart();
          clearCartBackup();
          push('Cart restored');
        }
      } catch {}
      setOrderSnapshot(null);
      persist({ orderSnapshot: null });
      setModalOpen(true);
    }
  }, [mm.status]);

  function exportSummary() {
    const snap = orderSnapshot || { items, total };
    const lines = [
      `Order: ${orderRef}`,
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      `Delivery: ${form.delivery}`,
      ...(form.delivery==='delivery' ? [`Address: ${form.address}`] : []),
      `Payment: ${paymentRef || 'N/A'}`,
      'Items:',
      ...((Array.isArray(snap.items) ? snap.items : items).map(i => `  - ${i.name} x${i.qty} = ${formatKES(i.price * i.qty)}`)),
      `Total: ${formatKES(snap.total)}`
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `order-${orderRef}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    push('Summary downloaded');
  }

  async function exportPdf() {
    // Build snapshot with inclusive VAT extraction if needed
    let snap = (orderSnapshot && Array.isArray(orderSnapshot.items)) ? orderSnapshot : { items, total };
    if (snap && (snap.subtotal == null || snap.vat == null)) {
      const vatPortion = +(snap.total - (snap.total / (1 + VAT_RATE))).toFixed(2);
      const net = +(snap.total - vatPortion).toFixed(2);
      snap = { ...snap, subtotal: net, vat: vatPortion };
    }
    try {

      // Generate QR code (data URL) with minimal payload
      let qrDataUrl = '';
      try {
        qrDataUrl = await QRCode.toDataURL(JSON.stringify({ orderRef, total: snap.total }));
      } catch {}

      const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 50, 40, 60],
        content: [
          { text: BRAND_RECEIPT_TITLE, style: 'brand' },
          { text: 'Receipt (Customer Copy)', style: 'subheader', margin: [0, 0, 0, 12] },
          {
            columns: [
              [
                { text: `Order: ${orderRef}`, style: 'meta' },
                paymentRef ? { text: `Payment: ${paymentRef}`, style: 'meta' } : null,
                { text: `Date: ${new Date(snap.ts || Date.now()).toLocaleString()}`, style: 'meta' },
                { text: `Method: ${resolvedPaymentLabel}`, style: 'meta' }
              ].filter(Boolean),
              [
                { text: 'Customer', style: 'metaBold', alignment: 'right' },
                { text: form.name, style: 'meta', alignment: 'right' },
                { text: form.phone, style: 'meta', alignment: 'right' },
                form.delivery === 'delivery' ? { text: form.address, style: 'meta', alignment: 'right' } : null
              ].filter(Boolean)
            ]
          },
          { text: 'Items', style: 'sectionTitle', margin: [0, 18, 0, 6] },
          {
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto', 'auto'],
              body: [
                [
                  { text: 'Item', style: 'tableHead' },
                  { text: 'Qty', style: 'tableHead', alignment: 'center' },
                  { text: 'Price', style: 'tableHead', alignment: 'right' },
                  { text: 'Subtotal', style: 'tableHead', alignment: 'right' }
                ],
                ...snap.items.map(i => [
                  { text: i.name, style: 'tableCell' },
                  { text: String(i.qty), style: 'tableCell', alignment: 'center' },
                  { text: formatKES(i.price), style: 'tableCell', alignment: 'right' },
                  { text: formatKES(i.price * i.qty), style: 'tableCell', alignment: 'right' }
                ])
              ]
            },
            layout: 'lightHorizontalLines'
          },
          {
            columns: [
              { width: '*', text: '' },
              {
                width: 'auto',
                table: {
                  body: [
                    [ { text: 'Net (Excl VAT):', style: 'meta' }, { text: formatKES(snap.subtotal), style: 'meta', alignment: 'right' } ],
                    [ { text: 'VAT 16%:', style: 'meta' }, { text: formatKES(snap.vat), style: 'meta', alignment: 'right' } ],
                    [ { text: 'TOTAL (Incl):', style: 'totalLabel' }, { text: formatKES(snap.total), style: 'totalValue', alignment: 'right' } ]
                  ]
                },
                layout: 'noBorders',
                margin: [0, 12, 0, 0]
              }
            ]
          },
          (/^data:image\/png;base64,/.test(qrDataUrl) && qrDataUrl.length > 100) ? { image: qrDataUrl, width: 110, alignment: 'center', margin: [0, 28, 0, 10] } : { text: '', margin: [0, 20, 0, 0] },
          { text: `Asante kwa kununua!\n${BRAND_COPY_FOOTER}` , alignment: 'center', style: 'footer' }
        ],
        styles: {
          brand: { fontSize: 22, bold: true, alignment: 'center', color: '#1a7f37', margin: [0,0,0,4] },
          header: { fontSize: 20, bold: true, alignment: 'center' },
          subheader: { fontSize: 11, italics: true, alignment: 'center', color: '#555' },
          sectionTitle: { fontSize: 12, bold: true },
          tableHead: { bold: true, fillColor: '#F3F4F6' },
          tableCell: { fontSize: 10 },
          meta: { fontSize: 9, color: '#333' },
          metaBold: { fontSize: 9, bold: true, color: '#111' },
          totalLabel: { bold: true, fontSize: 10, margin: [0, 4, 12, 0] },
          totalValue: { bold: true, fontSize: 10, margin: [0, 4, 0, 0] },
          footer: { fontSize: 9, color: '#444' }
        },
        defaultStyle: { fontSize: 9 }
      };

      pdfMake.createPdf(docDefinition).download(`receipt-${orderRef}.pdf`);
      push('Receipt PDF downloaded');
    } catch (err) {
      console.error('PDF export failed', err);
      push('PDF generation failed', 'error');
    }
  }

  async function mockEmail() {
    let snap = (orderSnapshot && Array.isArray(orderSnapshot.items)) ? orderSnapshot : { items, total };
    if (snap && (snap.subtotal == null || snap.vat == null)) {
      const vatPortion = +(snap.total - (snap.total / (1 + VAT_RATE))).toFixed(2);
      const net = +(snap.total - vatPortion).toFixed(2);
      snap = { ...snap, subtotal: net, vat: vatPortion };
    }
    const pretty = [
  `${BRAND_RECEIPT_TITLE} Receipt`,
      `Order: ${orderRef}`,
      paymentRef ? `Payment Ref: ${paymentRef}` : '',
      `Date: ${new Date(snap.ts || Date.now()).toLocaleString()}`,
      `Customer: ${form.name}`,
      `Phone: ${form.phone}`,
      form.delivery==='delivery' ? `Address: ${form.address}` : 'Pickup at store',
      '',
      'Items:'
    ].filter(Boolean);
    (Array.isArray(snap.items) ? snap.items : items).forEach(i => pretty.push(` - ${i.name} x${i.qty} @ ${formatKES(i.price)} = ${formatKES(i.price*i.qty)}`));
  pretty.push('', `Net (Excl VAT): ${formatKES(snap.subtotal)}`, `VAT (16%): ${formatKES(snap.vat)}`, `TOTAL (Incl): ${formatKES(snap.total)}`, '', 'Asante!');
    const res = await sendEmailMock({ orderRef, total: snap.total, phone: form.phone, body: pretty.join('\n') });
    if (res.sent) push('Email sent (mock)');
  }

  // If a prior order was confirmed but user added new items, restart flow
  useEffect(() => {
    if (submitted && items.length && step === 3) {
      setSubmitted(false);
      setStep(1);
      persist({ submitted: false, step: 1 });
    }
  }, [items.length]);

  useEffect(() => {
    if (submitted) return;
    if (!orderSnapshot?.backendOrderId) return;
    if (!items.length) return;
    const liveSig = buildCartSignature(items);
    const snapshotSig = orderSnapshot.cartSignature ?? buildCartSignature(orderSnapshot.items);
    if (liveSig !== snapshotSig) {
      setOrderSnapshot(null);
      persist({ orderSnapshot: null });
    }
  }, [items, submitted, orderSnapshot?.backendOrderId, orderSnapshot?.cartSignature]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const hasActiveItems = (items && items.length > 0) || (orderSnapshot?.items?.length > 0);
        if (!hasActiveItems) {
          if (mounted) {
            setOptionsLoading(false);
            setPaymentOptions([]);
          }
          return;
        }
        setOptionsLoading(true);
        const opts = await api.payments.options();
        if (mounted) setPaymentOptions(opts);
      } catch (err) {
        console.error('Could not load payment options', err);
        if (mounted) setPaymentOptions([]);
      } finally {
        if (mounted) setOptionsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [items, orderSnapshot?.items?.length]);

  function openOption(opt) {
    setSelectedOption(opt);
    setModalPhone(form.phone || '');
    setModalAccountRef('');
    setModalOpen(true);
  }
  async function initiateFromOption() {
    if (!selectedOption) return;
    if (['initiating','pending','reconciling'].includes(mm.status)) {
      push('Payment already in progress. Please wait for confirmation before starting another.', 'warning');
      return;
    }
    if (orderSnapshot?.backendOrderId && ['INITIATED','PENDING'].includes(orderSnapshot?.paymentStatus ?? '')) {
      push('An order payment is already in progress. Please wait for confirmation or restart checkout to create a new order.', 'warning');
      return;
    }
    try {
      // Ensure backend order exists
      let backendOrderId = orderSnapshot?.backendOrderId;
      const snapshotUserId = orderSnapshot?.userId ?? null;
      const currentUserId = authUser?.id ?? null;
      if (backendOrderId && snapshotUserId !== currentUserId) {
        backendOrderId = null;
        setOrderSnapshot(null);
        persist({ orderSnapshot: null });
      }
      if (!backendOrderId) {
        const created = await ensureBackendOrder();
        if (!created) return;
        backendOrderId = created.id;
      }
      if (selectedOption.supportsStk) {
        const payload = {
          orderId: backendOrderId,
          provider: selectedOption.provider,
          channel: selectedOption.channel,
          method: 'MOBILE_MONEY',
          amount: formattedSnapshotTotal,
          phoneNumber: modalPhone,
          accountReference: modalAccountRef || undefined,
          supportsStk: true
        };
        await mm.initiate(payload);
      } else {
        // manual initiation
        await api.payments.initiateManual({
          orderId: backendOrderId,
          paymentOptionId: selectedOption.id,
          amount: formattedSnapshotTotal,
          phoneNumber: modalPhone || undefined,
          accountReference: modalAccountRef || undefined
        });
        // start polling using hook's internal poller by seeding orderId
        mm.initiate({ orderId: backendOrderId, provider: selectedOption.provider, channel: selectedOption.channel, method: 'MOBILE_MONEY', amount: formattedSnapshotTotal, phoneNumber: modalPhone });
      }
    } catch (e) {
      push(e.message || 'Could not start payment', 'error');
    }
  }

  const continueWithCash = async () => {
    if (cashSubmitting) return;
    if (!items.length) {
      push('Your cart is empty. Add items before placing an order.', 'warning');
      return;
    }

    const now = Date.now();
    const cartSignatureBefore = buildCartSignature(items);
    const cartItems = items.map((item, idx) => {
      const qty = Number.isFinite(Number(item.qty)) ? Number(item.qty) : 0;
      const priceValue = parseMoney(item.price) ?? 0;
      const unitGross = roundCurrency(priceValue) ?? priceValue;
      return {
        id: item.id ?? idx,
        name: item.name ?? `Item ${idx + 1}`,
        price: unitGross,
        qty
      };
    });
    const gross = roundCurrency(liveCartTotal) ?? liveCartTotal;
    const vatPortion = roundCurrency(gross - (gross / (1 + VAT_RATE))) ?? 0;
    const net = roundCurrency(gross - vatPortion) ?? gross;

    setCashSubmitting(true);
    let createdOrder = null;
    try {
      createdOrder = await ensureBackendOrder();
      if (!createdOrder) {
        setCashSubmitting(false);
        return;
      }
      const backendOrderId = createdOrder.id ?? orderSnapshot?.backendOrderId;
      if (!backendOrderId) {
        push('Unable to prepare your cash payment. Please try again.', 'error');
        setCashSubmitting(false);
        return;
      }

      const paymentResp = await api.payments.create({ orderId: backendOrderId, method: 'CASH_ON_DELIVERY' });
      const paymentData = paymentResp?.data ?? paymentResp;
      const paymentStatus = (paymentData?.status ?? 'PENDING').toUpperCase();
      const paymentMethodCode = paymentData?.method ?? 'CASH_ON_DELIVERY';
      const paymentProgress = paymentData ? {
        id: paymentData.id,
        status: paymentStatus,
        method: paymentMethodCode,
        provider: paymentData.provider ?? null,
        channel: paymentData.channel ?? null,
        amount: paymentData.amount ?? gross,
        createdAt: paymentData.createdAt ?? new Date(now).toISOString(),
        updatedAt: paymentData.updatedAt ?? paymentData.createdAt ?? null,
        externalRequestId: paymentData.externalRequestId ?? null,
        externalTransactionId: paymentData.externalTransactionId ?? null
      } : null;

      const backendSubtotal = parseMoney(createdOrder?.totalNet ?? createdOrder?.subtotal ?? createdOrder?.netTotal);
      const backendVat = parseMoney(createdOrder?.vatAmount ?? createdOrder?.vat ?? createdOrder?.taxAmount);
      const backendTotal = parseMoney(createdOrder?.totalGross ?? createdOrder?.total ?? createdOrder?.totalAmount);

      const snapshotItems = Array.isArray(createdOrder?.items) && createdOrder.items.length > 0
        ? createdOrder.items.map((item, idx) => {
            const fallbackSource = cartItems[idx];
            const product = item.product || {};
            const qtyRaw = item.quantity ?? item.qty ?? fallbackSource?.qty ?? 0;
            const qty = Number.isFinite(Number(qtyRaw)) ? Number(qtyRaw) : 0;
            const lineGross = parseMoney(item.totalGross ?? item.lineTotal ?? item.totalAmount ?? item.total);
            const unitGross = parseMoney(item.unitPriceGross ?? item.price ?? item.unitPrice);
            const fallbackUnit = parseMoney(fallbackSource?.price);
            const resolvedUnit = unitGross != null ? unitGross : (qty > 0 && lineGross != null ? lineGross / qty : fallbackUnit);
            const productId = product.id ?? item.productId ?? fallbackSource?.id ?? item.id ?? idx;
            const label = (product.name ?? item.productName ?? item.name ?? fallbackSource?.name ?? `Item ${productId}`).toString();
            const roundedUnit = roundCurrency(resolvedUnit) ?? fallbackUnit ?? 0;
            return { id: productId, name: label, price: roundedUnit, qty };
          })
        : cartItems;

      const resolvedSubtotal = roundCurrency(backendSubtotal ?? net) ?? net;
      const resolvedVat = roundCurrency(backendVat ?? vatPortion) ?? vatPortion;
      const resolvedTotal = roundCurrency(backendTotal ?? gross) ?? gross;
      const snapshotUserId = createdOrder?.user?.id ?? createdOrder?.user_id ?? (authUser?.id ?? null);

      const snapshot = {
        items: snapshotItems,
        subtotal: resolvedSubtotal,
        vat: resolvedVat,
        total: resolvedTotal,
        ts: now,
        backendOrderId,
        cartSignature: cartSignatureBefore,
        userId: snapshotUserId,
        paymentStatus,
        paymentMethod: paymentMethodCode,
        paymentProgress,
      };

      setOrderSnapshot(snapshot);
      setPaymentRef('');
      setSubmitted(true);
      setStep(3);
      persist({ orderSnapshot: snapshot, submitted: true, step: 3, payMethod: 'cash' });

      try { clearCartBackup(); } catch {}

      try {
        const itemsForStorage = snapshotItems.map((item, idx) => {
          const qty = Number.isFinite(Number(item.qty)) ? Number(item.qty) : 0;
          const unitGross = Number.isFinite(Number(item.price)) ? Number(item.price) : 0;
          const unitNet = roundCurrency(unitGross / (1 + VAT_RATE)) ?? unitGross;
          const unitVat = roundCurrency(unitGross - unitNet) ?? 0;
          return {
            id: item.id ?? idx,
            productId: item.id ?? idx,
            productName: item.name,
            quantity: qty,
            unitPriceGross: unitGross,
            unitPriceNet: unitNet,
            vatAmount: unitVat
          };
        });
        const isoCreatedAt = new Date(now).toISOString();
        appendGuestOrder({
          id: backendOrderId,
          sessionId: guestSessionId,
          orderRef,
          createdAt: isoCreatedAt,
          customerName: form.name,
          customerPhone: form.phone,
          items: itemsForStorage,
          totalGross: resolvedTotal,
          totalNet: resolvedSubtotal,
          vatAmount: resolvedVat,
          paymentStatus,
          paymentMethod: paymentMethodCode,
          paymentProgress,
          snapshot,
          guestPaymentRef: null,
          guestPaymentMethod: 'cash'
        }, guestSessionId);
      } catch {}

      push('Order placed. Please pay when your items arrive.', 'success');
    } catch (e) {
      if (createdOrder && hasCartBackup) {
        try {
          restoreCart();
        } catch {}
      }
      push(e.message || 'Could not record cash payment. Please contact support or try again.', 'error');
    } finally {
      setCashSubmitting(false);
    }
  };

  if (shouldRedirectToCart) {
    return (
      <section className="py-5">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-7">
              <div className="card shadow-sm border-0">
                <div className="card-body text-center p-5">
                  <i className="bi bi-basket2-fill display-4 text-success mb-3" aria-hidden="true"></i>
                  <h1 className="h4 mb-3">Your cart is empty</h1>
                  <p className="text-muted mb-4">Add a few items to get started or review your recent orders.</p>
                  <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
                    <Link to="/" className="btn btn-success d-flex align-items-center justify-content-center gap-1">
                      <i className="bi bi-shop"></i>
                      <span>Go Shopping</span>
                    </Link>
                    <Link to="/orders" className="btn btn-outline-secondary d-flex align-items-center justify-content-center gap-1">
                      <i className="bi bi-receipt"></i>
                      <span>Go to My Orders</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (submitted && step === 3) {
    const snap = orderSnapshot || { items: [], total };
    return (
      <section>
        <h1 className="h3 mb-3">Order Confirmed</h1>
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body">
            <div className="d-flex flex-column flex-md-row justify-content-between mb-3 gap-2">
              <div>
                <h2 className="h6 mb-1">Receipt</h2>
                <p className="small text-muted mb-0">Ref: <strong>{orderRef}</strong></p>
                {paymentRef && (
                  <p className="small text-muted mb-0">
                    Payment: <strong>{paymentRef}</strong> ({resolvedPaymentLabel})
                  </p>
                )}
                {!paymentRef && resolvedPaymentLabel && (
                  <p className="small text-muted mb-0">Payment Method: {resolvedPaymentLabel}</p>
                )}
                <p className="small text-muted mb-0">Date: {new Date(snap.ts || Date.now()).toLocaleString()}</p>
              </div>
              <div className="text-md-end">
                <p className="mb-0 fw-semibold">Customer</p>
                <p className="small mb-0">{form.name}</p>
                <p className="small mb-0">{form.phone}</p>
                {form.delivery==='delivery' && <p className="small mb-0">Address: {form.address}</p>}
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-3">
                <thead>
                  <tr className="table-light"><th>Item</th><th className="text-center" style={{width:'70px'}}>Qty</th><th className="text-end" style={{width:'110px'}}>Price</th><th className="text-end" style={{width:'120px'}}>Subtotal</th></tr>
                </thead>
                <tbody>
                  {snap.items.map(i => (
                    <tr key={i.id}>
                      <td>{i.name}</td>
                      <td className="text-center">{i.qty}</td>
                      <td className="text-end">{formatKES(i.price)}</td>
                      <td className="text-end">{formatKES(i.price * i.qty)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3} className="text-end">Net (Excl VAT)</th>
                    <th className="text-end">{formatKES(snap.subtotal ?? snap.total)}</th>
                  </tr>
                  <tr>
                    <th colSpan={3} className="text-end">VAT 16%</th>
                    <th className="text-end">{formatKES(snap.vat ?? 0)}</th>
                  </tr>
                  <tr>
                    <th colSpan={3} className="text-end">Total</th>
                    <th className="text-end">{formatKES(snap.total)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="small text-muted">We will contact you on {form.phone}{form.delivery === 'delivery' ? ` and deliver to ${form.address}` : ' when your order is ready for pickup'}.</p>
            <div className="d-flex flex-wrap gap-2 mt-2">
              <button onClick={exportSummary} className="btn btn-outline-secondary btn-sm"><i className="bi bi-filetype-txt me-1"></i>Text</button>
              <button onClick={exportPdf} className="btn btn-outline-secondary btn-sm"><i className="bi bi-filetype-pdf me-1"></i>PDF</button>
              <button onClick={mockEmail} className="btn btn-outline-secondary btn-sm"><i className="bi bi-envelope me-1"></i>Email</button>
              <button onClick={()=>window.print()} className="btn btn-outline-secondary btn-sm"><i className="bi bi-printer me-1"></i>Print</button>
              <button onClick={() => { sessionStorage.removeItem('checkout'); navigate('/'); }} className="btn btn-success btn-sm ms-auto"><i className="bi bi-house-door me-1"></i>Home</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
  <section className="container py-3 px-3 px-sm-4">
      <h1 id="checkout-heading" tabIndex="-1" className="h3 mb-3">Checkout</h1>
      <ProgressSteps current={step} />
      <div className="row g-4">
        <div className="col-12 col-lg-7">
          {step === 1 && (
            <form onSubmit={handleSubmit(onSubmitDetails)} noValidate>
              <div className="mb-3">
                <label className="form-label">Full Name</label>
                <input placeholder="Jane Doe" aria-invalid={!!errors.name} {...register('name', nameRules)} className={`form-control ${errors.name ? 'is-invalid' : touchedFields.name ? 'is-valid' : ''}`} />
                {errors.name && <div className="invalid-feedback d-block small">{errors.name.message}</div>}
              </div>
              <div className="mb-3">
                <label className="form-label">Phone</label>
                <input placeholder="07xx xxx xxx" aria-invalid={!!errors.phone} {...register('phone', phoneRules)} className={`form-control ${errors.phone ? 'is-invalid' : touchedFields.phone ? 'is-valid' : ''}`} />
                {errors.phone && <div className="invalid-feedback d-block small">{errors.phone.message}</div>}
              </div>
              <div className="mb-3">
                <label className="form-label">Delivery Method</label>
                <select className="form-select" {...register('delivery')}>
                  <option value="pickup">Store Pickup</option>
                  <option value="delivery">Home Delivery</option>
                </select>
              </div>
              {form.delivery === 'delivery' && (
                <div className="mb-3">
                  <label className="form-label">Address</label>
                  <textarea placeholder="Estate, Street, House no." aria-invalid={!!errors.address} {...register('address', addressRules(form.delivery === 'delivery'))} className={`form-control ${errors.address ? 'is-invalid' : touchedFields.address ? 'is-valid' : ''}`} />
                  {errors.address && <div className="invalid-feedback d-block small">{errors.address.message}</div>}
                </div>
              )}
              <div className="d-flex gap-2 flex-wrap">
                <button type="submit" className="btn btn-success flex-grow-1 flex-sm-grow-0">Continue</button>
                <button type="button" className="btn btn-outline-secondary flex-grow-1 flex-sm-grow-0" onClick={() => navigate('/cart')}>Back</button>
              </div>
            </form>
          )}
          {step === 2 && (
            <div>
              <h2 className="h5 mb-2">Payment</h2>
              <p className="text-muted small mb-2">Choose how you’d like to pay for this order.</p>
              <fieldset className="border rounded p-3 mb-3">
                <legend className="float-none w-auto px-2 text-uppercase small text-muted mb-0">Payment Method</legend>
                <div className="form-check mb-2">
                  <input className="form-check-input" type="radio" name="paymentMethod" id="pay-mobile" value="mobile-money" checked={payMethod==='mobile-money'} onChange={()=>handlePayMethodChange('mobile-money')} />
                  <label className="form-check-label fw-semibold" htmlFor="pay-mobile">Mobile Money</label>
                  <div className="form-text">Instant M-Pesa or Airtel STK push to your phone.</div>
                </div>
                <div className="form-check mb-2">
                  <input className="form-check-input" type="radio" name="paymentMethod" id="pay-cash" value="cash" checked={payMethod==='cash'} onChange={()=>handlePayMethodChange('cash')} />
                  <label className="form-check-label fw-semibold" htmlFor="pay-cash">Cash on Delivery</label>
                  <div className="form-text">Pay when your order arrives or at pickup.</div>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="paymentMethod" id="pay-card" value="card" checked={payMethod==='card'} onChange={()=>handlePayMethodChange('card')} />
                  <label className="form-check-label fw-semibold" htmlFor="pay-card">Card</label>
                  <div className="form-text">Pay with Visa or Mastercard (coming soon).</div>
                </div>
              </fieldset>

              {payMethod === 'mobile-money' && (
                <>
                  {optionsLoading && <p className="small text-muted">Loading options…</p>}
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {paymentOptions.map(opt => {
                      const b = paymentBranding[opt.provider] || { color:'#222', bg:'#eee' };
                      const subtitle = opt.shortDescription || summarizeInstructions(opt.instructionsMarkdown) || opt.channel;
                      return (
                        <button key={opt.id} type="button" onClick={()=>openOption(opt)} className="btn btn-light border position-relative" style={{minWidth:180, textAlign:'left'}}>
                          <span className="d-flex align-items-center gap-2">
                            <span style={{width:26,height:26,background:b.color,color:'#fff',borderRadius:6,fontSize:12,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>{opt.provider[0]}</span>
                            <span className="d-flex flex-column">
                              <strong className="small mb-0" style={{color:b.color}}>{opt.displayName}</strong>
                              <span className="text-muted small" style={{lineHeight:1.1}}>{subtitle}</span>
                            </span>
                          </span>
                          {opt.supportsStk && <span className="badge bg-success position-absolute top-0 end-0 m-1" style={{fontSize:'0.6rem'}}>STK</span>}
                        </button>
                      );
                    })}
                    {paymentOptions.length===0 && !optionsLoading && (
                      <div className="alert alert-warning w-100 py-2 small">No payment options configured.</div>
                    )}
                  </div>
                  {mm.status==='pending' && <p className="small text-muted mt-2">Awaiting confirmation on your phone…</p>}
                  {mm.status==='timeout' && <p className="small text-danger mt-2">Timed out waiting for confirmation. Try again.</p>}
                  {mm.error && <p className="small text-danger mt-2">{mm.error}</p>}
                </>
              )}

              {payMethod === 'cash' && (
                <div className="alert alert-success small">
                  We’ll prepare your order and you can pay in cash when it’s delivered or collected.
                </div>
              )}

              {payMethod === 'card' && (
                <div className="alert alert-info small">
                  Card payments are almost ready. In the meantime, please choose another payment method.
                </div>
              )}

              {/* Reconciliation moved inside modal for manual (non-STK) flows */}
              <div className="d-flex gap-2 flex-wrap mt-3">
                {payMethod === 'cash' && (
                  <button
                    type="button"
                    className="btn btn-success flex-grow-1 flex-sm-grow-0 d-flex align-items-center justify-content-center gap-2"
                    onClick={continueWithCash}
                    disabled={cashSubmitting}
                  >
                    {cashSubmitting && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
                    <span>Continue</span>
                  </button>
                )}
                {payMethod === 'card' && (
                  <button type="button" className="btn btn-success flex-grow-1 flex-sm-grow-0" disabled>Continue</button>
                )}
                <button type="button" className="btn btn-outline-secondary flex-grow-1 flex-sm-grow-0" onClick={()=>setStep(1)}>Back</button>
              </div>
            </div>
          )}
          {step === 3 && !submitted && <p>Finalizing…</p>}
        </div>
        <div className="col-12 col-lg-5">
          <div className="border rounded p-3 bg-body">
            <h2 className="h6">Summary</h2>
            {(() => {
              const snap = (orderSnapshot && Array.isArray(orderSnapshot.items)) ? orderSnapshot : { items, total };
              return (
                <ul className="list-unstyled small mb-2">
                  {(Array.isArray(snap.items) ? snap.items : items).map(i => (
                <li key={i.id} className="d-flex justify-content-between border-bottom py-1">
                  <span>{i.name} × {i.qty}</span>
                  <span>{formatKES(i.price * i.qty)}</span>
                </li>
                  ))}
                </ul>
              );
            })()}
            <p className="fw-semibold mb-0">Total: {formatKES((orderSnapshot?.total) ?? total)}</p>
          </div>
        </div>
      </div>
      <PaymentOptionModal
        option={selectedOption}
        open={modalOpen}
        onClose={()=>setModalOpen(false)}
        onInitiate={initiateFromOption}
        onReconcile={async (phone, amountVal)=>{
          if (!selectedOption) return;
          const backendOrderId = orderSnapshot?.backendOrderId;
          if (!backendOrderId) { push('Create order first by starting payment', 'error'); return; }
          try {
            await mm.reconcile({ orderId: backendOrderId, provider: selectedOption.provider, phoneNumber: phone || undefined, amount: amountVal ? Number(amountVal) : undefined });
          } catch {/* handled in hook */}
        }}
  reconciling={modalPaymentState==='reconciling'}
  paymentStatus={effectivePaymentStatus}
  loading={modalPaymentState==='initiating'}
  paymentHookStatus={modalPaymentState}
        phone={modalPhone}
        setPhone={setModalPhone}
        accountRef={modalAccountRef}
        setAccountRef={setModalAccountRef}
        amount={formattedSnapshotTotal}
      />
    </section>
  );
}
// ReconcileForm removed; functionality moved into PaymentOptionModal
