// Sample order history used to populate dashboards. No real purchase or payment took place.

import products from './products.js';
import users, { seedAddresses, SAMPLE_BUYER_ID } from './users.js';
import { daysAgo } from '../utils/formatDate.js';
import { calculateCartTotals, getUnitPrice } from '../utils/calculateTotals.js';

const product = (id) => products.find((item) => item.id === id);
const buyer = (id) => users.find((user) => user.id === id);
const sampleAddress = seedAddresses[SAMPLE_BUYER_ID][0];

/** Turns a product + quantity into the snapshot stored on an order. */
export function toOrderItem(item, quantity, variant = null) {
  return {
    productId: item.id, name: item.name, slug: item.slug, companyId: item.companyId, unit: item.unit,
    photo: item.photo, illustration: item.illustration, quantity, variant, unitPrice: getUnitPrice(item, quantity),
  };
}

const rows = [
  // id, buyer, [[productId, qty]...], shipping, payment, status, days ago
  ['TS-O-24001', 'TS-U-001', [['TS-P-1001', 500], ['TS-P-1002', 1000]], 'sea', 'cod', 'Delivered', 46],
  ['TS-O-24002', 'TS-U-001', [['TS-P-1027', 10000], ['TS-P-1031', 2000]], 'sea', 'netbanking', 'Shipped', 19],
  ['TS-O-24003', 'TS-U-004', [['TS-P-1008', 400], ['TS-P-1007', 600]], 'air', 'card', 'In Production', 12],
  ['TS-O-24004', 'TS-U-001', [['TS-P-1022', 1000], ['TS-P-1025', 300]], 'express', 'upi', 'Confirmed', 6],
  ['TS-O-24005', 'TS-U-006', [['TS-P-1032', 100], ['TS-P-1033', 400]], 'air', 'card', 'Pending', 3],
  ['TS-O-24006', 'TS-U-005', [['TS-P-1013', 120], ['TS-P-1011', 200]], 'sea', 'wallet', 'Delivered', 60],
  ['TS-O-24007', 'TS-U-007', [['TS-P-1004', 300]], 'air', 'cod', 'Cancelled', 28],
  ['TS-O-24008', 'TS-U-001', [['TS-P-1003', 200], ['TS-P-1044', 20]], 'sea', 'upi', 'Pending', 1],
];

const orders = rows.map(([id, buyerId, lines, shippingMethod, paymentMethod, status, days]) => {
  const account = buyer(buyerId);
  const pairs = lines.map(([productId, quantity]) => ({ product: product(productId), quantity }));
  const { subtotal, shipping, tax, total } = calculateCartTotals(pairs, shippingMethod);
  return {
    id, isSample: true, buyerId, buyerName: account.name, buyerCompany: account.company,
    items: pairs.map((pair) => toOrderItem(pair.product, pair.quantity)),
    shippingMethod, paymentMethod, totals: { subtotal, shipping, tax, total },
    contact: { name: account.name, email: account.email, phone: account.phone, company: account.company },
    address: buyerId === SAMPLE_BUYER_ID
      ? sampleAddress
      : { label: 'Office', name: account.name, company: account.company, phone: account.phone, line1: '1 Example Street', line2: '', city: 'Sample City', state: '', postalCode: '00000', country: account.country },
    paymentStatus: status === 'Delivered' ? 'Paid' : paymentMethod === 'cod' ? 'Cash on Delivery: payment pending' : 'Payment pending', source: 'cart',
    status, createdAt: daysAgo(days, 3),
  };
});

export default orders;
