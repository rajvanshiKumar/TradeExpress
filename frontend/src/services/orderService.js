import seedOrders, { toOrderItem } from '../data/orders';
import { STORAGE_KEYS } from '../utils/constants';
import { createCollection, wait } from './localCollection';
import makeId from '../utils/ids';
import { apiGet, apiPost, isApiConfigured } from './apiClient';

const localOrders = createCollection(STORAGE_KEYS.orders, seedOrders);

function formatApiOrder(created, source = 'cart') {
  return {
    id: created.orderNumber || created.id,
    backendId: created.id,
    orderNumber: created.orderNumber,
    buyerId: created.userId || 'guest',
    buyerName: created.buyerName,
    buyerCompany: created.buyerCompany || '',
    items: (created.items || []).map((item) => ({
      productId: item.productId,
      name: item.productName,
      sku: item.productSku,
      photo: item.productPhoto,
      illustration: null,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
      variant: item.variant,
      companyId: item.companyId || null,
      slug: item.slug || item.productId,
    })),
    shippingMethod: created.shippingMethod,
    paymentMethod: created.paymentMethod,
    paymentStatus: created.paymentStatus === 'PAID' ? 'paid' : (created.paymentStatus === 'PARTIALLY_PAID' ? 'partially_paid' : (created.paymentStatus === 'COD' ? 'cod' : 'pending')),
    isPartialPayment: created.isPartialPayment || false,
    advanceAmount: created.advanceAmount ? Number(created.advanceAmount) : null,
    balanceDue: created.balanceDue ? Number(created.balanceDue) : null,
    carrierName: created.carrierName || null,
    trackingNumber: created.trackingNumber || null,
    invoiceUrl: created.invoiceUrl || null,
    ewayBillUrl: created.ewayBillUrl || null,
    rejectionReason: created.rejectionReason || null,
    cgst: created.cgst ? Number(created.cgst) : null,
    sgst: created.sgst ? Number(created.sgst) : null,
    igst: created.igst ? Number(created.igst) : null,
    isInterState: created.isInterState || false,
    source: created.source || source,
    totals: {
      subtotal: Number(created.subtotal),
      shipping: Number(created.shippingFee || 0),
      tax: Number(created.tax || 0),
      total: Number(created.total),
    },
    contact: {
      name: created.buyerName,
      email: created.buyerEmail,
      phone: created.buyerPhone,
      company: created.buyerCompany,
    },
    address: created.deliveryAddress,
    status: created.orderStatus === 'ORDER_CONFIRMED' ? 'Confirmed' : (created.orderStatus === 'ORDER_PLACED' ? 'Pending' : created.orderStatus),
    createdAt: created.createdAt,
  };
}

const orderService = {
  listOrders: async (options) => {
    if (isApiConfigured) {
      try {
        const res = await apiGet('orders/my-orders');
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          return res.data.map((item) => formatApiOrder(item));
        }
      } catch {
        // Fall back to local collection if not authenticated or error
      }
    }
    return localOrders.list(options);
  },

  saveOrders: (records) => localOrders.saveAll(records),
  saveOrder: (order) => localOrders.save(order),

  getOrder: async (identifier) => {
    if (isApiConfigured) {
      try {
        const res = await apiGet(`orders/${identifier}`);
        if (res.data) {
          return formatApiOrder(res.data);
        }
      } catch {
        // fallback
      }
    }
    const list = await localOrders.list();
    return list.find((o) => o.id === identifier || o.orderNumber === identifier) || null;
  },

  /** Creates an order record. Persists to MySQL via Express backend if API is configured. */
  async createOrder({ lines, totals, shippingMethod, paymentMethod, paymentStatus, source = 'cart', contact, address, buyer, isPartialPayment, advanceAmount, balanceDue, buyerGstin, supplierGstin }) {
    if (isApiConfigured) {
      try {
        const payload = {
          userId: buyer?.id && !String(buyer.id).startsWith('TS-') ? buyer.id : null,
          buyerName: contact?.name || buyer?.name || 'Customer',
          buyerEmail: contact?.email || buyer?.email || 'customer@example.com',
          buyerPhone: contact?.phone || buyer?.phone || '+91 98765 43210',
          buyerCompany: contact?.company || buyer?.company || '',
          shippingMethod,
          paymentMethod,
          deliveryAddress: address,
          isPartialPayment: Boolean(isPartialPayment),
          advanceAmount: advanceAmount ? Number(advanceAmount) : null,
          balanceDue: balanceDue ? Number(balanceDue) : null,
          buyerGstin: buyerGstin || buyer?.gstin || null,
          supplierGstin: supplierGstin || null,
          lines: lines.map((line) => ({
            productId: line.product?.id || line.productId,
            name: line.product?.name || line.name,
            sku: line.product?.sku || line.sku,
            slug: line.product?.slug || line.slug,
            quantity: line.quantity,
            variant: line.variant || null,
          })),
          idempotencyKey: `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          notes: `Placed via ${source}`,
        };

        const response = await apiPost('orders', payload);

        if (response && response.success && response.data) {
          const formatted = formatApiOrder(response.data, source);
          // Also mirror to local collection for instant offline access
          try {
            if (typeof localOrders.save === 'function') {
              await localOrders.save(formatted);
            }
          } catch {
            // Ignore local storage mirror errors
          }
          return formatted;
        }

        // If backend explicitly replied with failure
        throw new Error(response?.message || 'Order creation failed on backend.');
      } catch (err) {
        console.warn('[TradeExpress OrderService] Backend order creation error:', err.message);
        // If it's a real validation, stock, or authentication error, pass it to UI
        const isNetworkDown = err.message?.includes('timed out') || err.message?.includes('could not be reached') || err.status === 0;
        if (!isNetworkDown && err.status && err.status >= 400 && err.status < 500) {
          throw err;
        }
      }
    }

    // Fallback if API not configured or network unreachable
    await wait(300);
    const fallbackOrder = {
      id: makeId('TS-O'),
      orderNumber: `TS-${Date.now().toString(36).toUpperCase()}`,
      buyerId: buyer?.id || 'guest',
      buyerName: buyer?.name || contact?.name || 'Guest',
      buyerCompany: buyer?.company ?? '',
      items: lines.map((line) => toOrderItem(line.product, line.quantity, line.variant ?? null)),
      shippingMethod,
      paymentMethod,
      paymentStatus: paymentStatus || (paymentMethod === 'cod' ? 'cod' : 'pending'),
      source,
      totals: { subtotal: totals.subtotal, shipping: totals.shipping, tax: totals.tax, total: totals.total },
      contact: contact || {},
      address,
      status: paymentMethod === 'cod' ? 'Confirmed' : 'Pending',
      createdAt: new Date().toISOString(),
    };
    try {
      if (typeof localOrders.save === 'function') {
        await localOrders.save(fallbackOrder);
      }
    } catch {
      // Ignore local storage error
    }
    return fallbackOrder;
  },
};

export default orderService;
