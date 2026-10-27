// Sample quote requests (RFQs) used to populate dashboards.

import products from './products.js';
import users from './users.js';
import { daysAgo } from '../utils/formatDate.js';

const rows = [
  // id, buyer, product, qty, target price, destination, delivery, status, days, specs, quote
  ['TS-RFQ-5001', 'TS-U-001', 'TS-P-1001', 2000, 1290, 'India', 'Within 30 days', 'Quoted', 9, 'Matte black, custom logo on both ear cups, retail gift box.', { unitPrice: 1320, leadTimeDays: 18, note: 'Price includes logo printing. Gift box adds ₹30 per piece.' }],
  ['TS-RFQ-5002', 'TS-U-001', 'TS-P-1027', 20000, 12.5, 'India', 'Within 45 days', 'Negotiating', 6, '120 gsm kraft, twisted handles, one-colour print on both sides.', { unitPrice: 13.5, leadTimeDays: 20, note: 'We can reach ₹13 at 30,000 pieces.' }],
  ['TS-RFQ-5003', 'TS-U-004', 'TS-P-1008', 1500, 575, 'Brazil', 'Within 60 days', 'Viewed', 5, '320 gsm fleece, five colours, embroidered chest logo.', null],
  ['TS-RFQ-5004', 'TS-U-006', 'TS-P-1032', 150, 1740, 'United Kingdom', 'Within 30 days', 'Submitted', 2, 'Tan and black, cotton lining, embossed logo.', null],
  ['TS-RFQ-5005', 'TS-U-001', 'TS-P-1044', 60, 5480, 'India', 'Within 60 days', 'Submitted', 1, 'Black mesh, adjustable lumbar support, flat-packed.', null],
  ['TS-RFQ-5006', 'TS-U-005', 'TS-P-1013', 300, 1410, 'Nigeria', 'Within 45 days', 'Quoted', 14, 'Speckled white glaze, export cartons with dividers.', { unitPrice: 1480, leadTimeDays: 25, note: 'Drop-tested export cartons included.' }],
  ['TS-RFQ-5007', 'TS-U-007', 'TS-P-1004', 800, 1080, 'United Arab Emirates', 'Within 30 days', 'Closed', 33, 'Arabic language firmware and custom watch faces.', { unitPrice: 1130, leadTimeDays: 15, note: 'Firmware localisation included.' }],
  ['TS-RFQ-5009', 'TS-U-006', 'TS-P-1002', 1000, 500, 'United Kingdom', 'Within 30 days', 'Submitted', 1, 'White charging case, printed retail box, UK plug cable.', null],
  ['TS-RFQ-5008', 'TS-U-008', 'TS-P-1022', 3000, 190, 'Germany', 'Within 60 days', 'Viewed', 4, 'Private label, EU-compliant labelling, frosted glass bottle.', null],
];

const inquiries = rows.map(([id, buyerId, productId, quantity, targetPrice, destinationCountry, deliveryTime, status, days, specifications, quote]) => {
  const product = products.find((item) => item.id === productId);
  const buyer = users.find((user) => user.id === buyerId);
  return {
    id, isSample: true, buyerId, buyerName: buyer.name, buyerEmail: buyer.email,
    productId, productName: product.name, companyId: product.companyId,
    quantity, unit: product.unit, specifications, targetPrice, destinationCountry, deliveryTime,
    message: 'Please share your best price, lead time and sample policy for this quantity.',
    status, createdAt: daysAgo(days, 2),
    quote: quote ? { ...quote, at: daysAgo(Math.max(days - 1, 0)) } : null,
  };
});

export default inquiries;
