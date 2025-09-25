import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { nameRules, phoneRules, addressRules } from '../utils/validation.js';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const VAT_RATE = 0.16; // 16% VAT (prices assumed VAT-inclusive)
  const { push } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const persisted = (() => {
    try { return JSON.parse(sessionStorage.getItem('checkout') || '{}'); } catch { return {}; }
  })();
  // Only block entry if no items AND no in-progress/finished order in session
  if (!items.length) {
    const persistedHasOrder = persisted && (persisted.submitted || persisted.step >= 2);
    if (!persistedHasOrder) {
      return (
        <section>
          <h1>Checkout</h1>
          <p>Your cart is empty. Add items first.</p>
          <button onClick={() => navigate('/')}>Browse Products</button>
        </section>
      );
    }
  }
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
  const [payMethod, setPayMethod] = useState(persisted.payMethod || 'mpesa');
  const [paymentRef, setPaymentRef] = useState('');
  const mm = useMobileMoneyPayment();
  const orderRef = useState(() => persisted.orderRef || generateOrderRef())[0];

  const [paymentOptions, setPaymentOptions] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [modalPhone, setModalPhone] = useState(form.phone || '');
  const [modalAccountRef, setModalAccountRef] = useState('');
  const [optionsLoading, setOptionsLoading] = useState(false);

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
    if (mm.status === 'initiating' || mm.status === 'pending') return;
    try {
      const provider = payMethod === 'mpesa' ? 'MPESA' : 'AIRTEL';
      const channel = payMethod === 'mpesa' ? 'MPESA_STK_PUSH' : 'AIRTEL_STK_PUSH';
      const payload = {
        orderId: orderSnapshot?.backendOrderId || (orderSnapshot?.tempOrderId), // placeholder; real order create could return id
        provider,
        channel,
        method: 'MOBILE_MONEY',
        amount: Number(total).toFixed(2),
        phoneNumber: form.phone
      };
      // Ensure order exists in backend before payment (create if not already saved)
      let backendOrderId = orderSnapshot?.backendOrderId;
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
      setOrderSnapshot(os => ({ ...(os||{}), backendOrderId: created.id }));
      persist({ orderSnapshot: { ...(orderSnapshot||{}), backendOrderId: created.id } });
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
    if (mm.status === 'succeeded' && !submitted) {
      // snapshot items and total before clearing cart
      // Prices already VAT-inclusive. Extract VAT portion: VAT = total - (total / (1+rate))
      const vatPortion = +(total - (total / (1 + VAT_RATE))).toFixed(2);
      const net = +(total - vatPortion).toFixed(2);
      const snapshot = {
        items: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
        subtotal: net,
        vat: vatPortion,
        total: total,
        ts: Date.now()
      };
      setOrderSnapshot(snapshot);
      setStep(3);
      setSubmitted(true);
      persist({ submitted: true, step: 3, paymentRef, orderSnapshot: snapshot });
      clearCart();
      push('Payment successful');
      // store order history
      try {
        const raw = localStorage.getItem('orders');
        const list = raw ? JSON.parse(raw) : [];
        list.unshift({
          orderRef,
            paymentRef: paymentRef,
            method: payMethod,
            snapshot,
            customer: { name: form.name, phone: form.phone, delivery: form.delivery, address: form.address },
            createdAt: snapshot.ts
        });
        localStorage.setItem('orders', JSON.stringify(list.slice(0,50)));
      } catch {}
    }
    if (mm.status === 'failed') {
      push('Payment failed', 'error');
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
      ...snap.items.map(i => `  - ${i.name} x${i.qty} = ${formatKES(i.price * i.qty)}`),
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
    let snap = orderSnapshot || { items, total };
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
                { text: `Method: ${payMethod === 'mpesa' ? 'M-Pesa' : 'Airtel'}`, style: 'meta' }
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
    let snap = orderSnapshot || { items, total };
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
    snap.items.forEach(i => pretty.push(` - ${i.name} x${i.qty} @ ${formatKES(i.price)} = ${formatKES(i.price*i.qty)}`));
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
    let mounted = true;
    (async () => {
      try {
        setOptionsLoading(true);
        const opts = await api.payments.options();
        if (mounted) setPaymentOptions(opts);
      } catch (e) { /* ignore */ }
      finally { setOptionsLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  function openOption(opt) {
    setSelectedOption(opt);
    setModalPhone(form.phone || '');
    setModalAccountRef('');
    setModalOpen(true);
  }

  async function initiateFromOption() {
    if (!selectedOption) return;
    try {
      // Ensure backend order exists
      let backendOrderId = orderSnapshot?.backendOrderId;
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
          amount: Number(total).toFixed(2),
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
          amount: Number(total).toFixed(2),
          phoneNumber: modalPhone || undefined,
          accountReference: modalAccountRef || undefined
        });
        // start polling using hook's internal poller by seeding orderId
        mm.initiate({ orderId: backendOrderId, provider: selectedOption.provider, channel: selectedOption.channel, method: 'MOBILE_MONEY', amount: Number(total).toFixed(2), phoneNumber: modalPhone });
      }
      setModalOpen(false);
    } catch (e) {
      push(e.message || 'Could not start payment', 'error');
    }
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
                {paymentRef && <p className="small text-muted mb-0">Payment: <strong>{paymentRef}</strong> ({payMethod === 'mpesa' ? 'M-Pesa' : 'Airtel'})</p>}
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
              <p className="text-muted small mb-2">Select a payment option below. STK supported methods will trigger a phone prompt; others show instructions.</p>
              {optionsLoading && <p className="small text-muted">Loading options…</p>}
              <div className="d-flex flex-wrap gap-2 mb-3">
                {paymentOptions.map(opt => {
                  const b = paymentBranding[opt.provider] || { color:'#222', bg:'#eee' };
                  return (
                    <button key={opt.id} type="button" onClick={()=>openOption(opt)} className="btn btn-light border position-relative" style={{minWidth:180, textAlign:'left'}}>
                      <span className="d-flex align-items-center gap-2">
                        <span style={{width:26,height:26,background:b.color,color:'#fff',borderRadius:6,fontSize:12,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>{opt.provider[0]}</span>
                        <span className="d-flex flex-column">
                          <strong className="small mb-0" style={{color:b.color}}>{opt.displayName}</strong>
                          <span className="text-muted small" style={{lineHeight:1.1}}>{opt.shortDescription || opt.channel}</span>
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
              {/* Reconciliation moved inside modal for manual (non-STK) flows */}
              <div className="d-flex gap-2 flex-wrap mt-3">
                <button type="button" className="btn btn-outline-secondary flex-grow-1 flex-sm-grow-0" onClick={()=>setStep(1)}>Back</button>
              </div>
            </div>
          )}
          {step === 3 && !submitted && <p>Finalizing…</p>}
        </div>
        <div className="col-12 col-lg-5">
          <div className="border rounded p-3 bg-body">
            <h2 className="h6">Summary</h2>
            <ul className="list-unstyled small mb-2">
              {items.map(i => (
                <li key={i.id} className="d-flex justify-content-between border-bottom py-1">
                  <span>{i.name} × {i.qty}</span>
                  <span>{formatKES(i.price * i.qty)}</span>
                </li>
              ))}
            </ul>
            <p className="fw-semibold mb-0">Total: {formatKES(total)}</p>
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
        reconciling={mm.status==='reconciling'}
        paymentStatus={mm.payment?.status}
        loading={mm.status==='initiating' || mm.status==='pending'}
        paymentHookStatus={mm.status}
        phone={modalPhone}
        setPhone={setModalPhone}
        accountRef={modalAccountRef}
        setAccountRef={setModalAccountRef}
        amount={Number(total).toFixed(2)}
      />
    </section>
  );
}
// ReconcileForm removed; functionality moved into PaymentOptionModal
