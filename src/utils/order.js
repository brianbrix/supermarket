const VAT_RATE = 0.16;

function toNumber(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

function fallbackProductName(item) {
  const id = item?.productId ?? item?.product_id;
  return id ? `Product #${id}` : 'Product';
}

export function normalizeOrder(raw) {
  if (!raw) return null;
  const sourceWrapper = raw && typeof raw === 'object' && !Array.isArray(raw) && raw.data && typeof raw.data === 'object'
    ? { ...raw, ...raw.data }
    : raw;
  const { data: _discard, ...source } = sourceWrapper;
  const createdAt = source.createdAt ?? source.created_at ?? source.placedAt ?? null;
  const updatedAt = source.updatedAt ?? source.updated_at ?? null;
  const orderNumber = source.orderNumber ?? source.order_number ?? source.orderRef ?? source.reference ?? null;
  const totalGross = toNumber(source.totalGross ?? source.total_gross ?? source.total ?? 0, 0);
  const totalNetRaw = source.totalNet ?? source.total_net;
  const vatAmountRaw = source.vatAmount ?? source.vat_amount;

  const items = Array.isArray(source.items)
    ? source.items.map(item => {
        const product = item.product ?? {};
        const unitGross = toNumber(item.unitPriceGross ?? item.unit_price_gross ?? item.unitPrice ?? item.price, 0);
        const unitNet = toNumber(item.unitPriceNet ?? item.unit_price_net, unitGross / (1 + VAT_RATE));
        const vat = toNumber(item.vatAmount ?? item.vat_amount, unitGross - unitNet);
        const productName = item.productName ?? item.product_name ?? product.name ?? fallbackProductName(item);
        const productSku = item.productSku ?? item.product_sku ?? product.sku ?? undefined;
        const quantity = toNumber(item.quantity, 0);
        const productImage = product.imageUrl ?? product.image_url ?? item.productImage ?? item.product_image ?? undefined;
        return {
          ...item,
          id: item.id ?? item.orderItemId ?? item.order_item_id ?? `${raw.id ?? raw.orderId ?? raw.order_id ?? 'order'}-${item.productId ?? item.product_id ?? Math.random()}`,
          productId: item.productId ?? item.product_id ?? null,
          productName,
          productSku,
          productImage,
          quantity,
          unitPriceGross: unitGross,
          unitPriceNet: unitNet,
          vatAmount: vat,
          product
        };
      })
    : [];

  const normalized = {
    ...source,
    id: source.id ?? source.orderId ?? source.order_id ?? null,
    orderNumber,
    customerName: source.customerName ?? source.customer_name ?? source.customer ?? '',
    customerPhone: source.customerPhone ?? source.customer_phone ?? source.phone ?? '',
    status: source.status ?? source.orderStatus ?? source.state ?? 'PENDING',
    totalGross,
    totalNet: toNumber(totalNetRaw, totalGross / (1 + VAT_RATE)),
    vatAmount: toNumber(vatAmountRaw, totalGross - toNumber(totalNetRaw, totalGross / (1 + VAT_RATE))),
    createdAt,
    updatedAt,
    items,
    itemsCount: raw.itemsCount ?? raw.items_count ?? items.length,
  };

  return normalized;
}

export function mergeOrders(primary, secondary) {
  if (!primary) return normalizeOrder(secondary);
  if (!secondary) return normalizeOrder(primary);
  const normalizedPrimary = normalizeOrder(primary);
  const normalizedSecondary = normalizeOrder(secondary);
  return {
    ...normalizedPrimary,
    ...normalizedSecondary,
    orderNumber: normalizedSecondary?.orderNumber ?? normalizedPrimary?.orderNumber,
    items: normalizedSecondary.items?.length ? normalizedSecondary.items : normalizedPrimary.items,
    itemsCount: normalizedSecondary.items?.length ? normalizedSecondary.items.length : normalizedPrimary.itemsCount,
    totalGross: normalizedSecondary.totalGross ?? normalizedPrimary.totalGross,
    totalNet: normalizedSecondary.totalNet ?? normalizedPrimary.totalNet,
    vatAmount: normalizedSecondary.vatAmount ?? normalizedPrimary.vatAmount
  };
}
