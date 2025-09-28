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
  const createdAt = raw.createdAt ?? raw.created_at ?? raw.placedAt ?? null;
  const updatedAt = raw.updatedAt ?? raw.updated_at ?? null;
  const orderNumber = raw.orderNumber ?? raw.order_number ?? raw.orderRef ?? raw.reference ?? null;
  const totalGross = toNumber(raw.totalGross ?? raw.total_gross ?? raw.total ?? 0, 0);
  const totalNetRaw = raw.totalNet ?? raw.total_net;
  const vatAmountRaw = raw.vatAmount ?? raw.vat_amount;

  const items = Array.isArray(raw.items)
    ? raw.items.map(item => {
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
    ...raw,
    id: raw.id ?? raw.orderId ?? raw.order_id ?? null,
    orderNumber,
    customerName: raw.customerName ?? raw.customer_name ?? raw.customer ?? '',
    customerPhone: raw.customerPhone ?? raw.customer_phone ?? raw.phone ?? '',
    status: raw.status ?? raw.orderStatus ?? raw.state ?? 'PENDING',
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
