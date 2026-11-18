/** Supplier purchase orders: database order -> Purchase Orders screen shape (pure; tested). */

// Database status -> the supplier screen's status (the page's actions and filters use these names)
export const SUPPLIER_ORDER_STATUS = {
  ORDER_PLACED: 'Pending',
  ORDER_CONFIRMED: 'Confirmed',
  PROCESSING: 'In Production',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};
export const SUPPLIER_ORDER_FILTERS = ['Pending', 'Confirmed', 'In Production', 'Packed', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'];

const paymentLabel = (s) => ({ PAID: 'paid', PARTIALLY_PAID: 'partially_paid', COD: 'cod', REFUNDED: 'refunded', FAILED: 'failed' }[s] || 'pending');

/** Database order -> the shape the Purchase Orders page and order details use. Only this supplier's lines count. */
export function toSupplierOrder(o, companyId) {
  return {
    id: o.orderNumber || o.id,
    backendId: o.id,
    orderNumber: o.orderNumber,
    buyerId: o.userId || null,
    buyerName: o.buyerName || 'Buyer',
    buyerCompany: o.buyerCompany || '',
    status: SUPPLIER_ORDER_STATUS[o.orderStatus] || o.orderStatus,
    rawStatus: o.orderStatus,
    paymentStatus: paymentLabel(o.paymentStatus),
    paymentMethod: o.paymentMethod,
    shippingMethod: o.shippingMethod,
    isPartialPayment: Boolean(o.isPartialPayment),
    advanceAmount: o.advanceAmount ?? null,
    balanceDue: o.balanceDue ?? null,
    rejectionReason: o.rejectionReason || null,
    trackingNumber: o.trackingNumber || null,
    carrierName: o.carrierName || null,
    cgst: o.cgst ?? null,
    sgst: o.sgst ?? null,
    igst: o.igst ?? null,
    isInterState: Boolean(o.isInterState),
    createdAt: o.createdAt,
    contact: { name: o.buyerName, email: o.buyerEmail, phone: o.buyerPhone, company: o.buyerCompany },
    address: o.deliveryAddress || null,
    totals: { subtotal: Number(o.subtotal || 0), shipping: Number(o.shippingFee || 0), tax: Number(o.tax || 0), total: Number(o.total || 0) },
    items: (o.items || []).map((i) => ({
      productId: i.productId,
      name: i.productName || 'Product',
      sku: i.productSku,
      photo: i.productPhoto || null,
      illustration: null,
      unit: i.unit,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice || 0),
      lineTotal: Number(i.lineTotal || 0),
      variant: i.variant || null,
      // Lines of this supplier carry its company id, so "your items" and values only count them
      companyId: i.mine ? companyId : null,
      productAvailable: Boolean(i.productAvailable),
      slug: i.productId,
    })),
  };
}
