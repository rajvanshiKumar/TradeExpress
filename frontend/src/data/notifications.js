import { daysAgo } from '../utils/formatDate.js';

// audience: a user ID, "company:<company id>" or "role:<role>".
const notifications = [
  { id: 'TS-N-001', audience: 'TS-U-001', type: 'quotes', title: 'Quote received', body: 'Shenzhen NovaTech Electronics replied to your request for Wireless Noise-Cancelling Headphones.', link: '/buyer/quotes', read: false, at: daysAgo(0, 4) },
  { id: 'TS-N-002', audience: 'TS-U-001', type: 'orders', title: 'Order shipped', body: 'Order TS-O-24002 is marked as shipped.', link: '/buyer/orders', read: false, at: daysAgo(2) },
  { id: 'TS-N-003', audience: 'TS-U-001', type: 'orders', title: 'Order delivered', body: 'Order TS-O-24001 is marked as delivered.', link: '/buyer/orders', read: true, at: daysAgo(20) },
  { id: 'TS-N-004', audience: 'company:TS-CO-001', type: 'quotes', title: 'New quote request', body: 'Emma Clarke asked about a sample order of True Wireless Earbuds.', link: '/supplier/inquiries', read: false, at: daysAgo(1) },
  { id: 'TS-N-005', audience: 'company:TS-CO-001', type: 'orders', title: 'New order', body: 'Order TS-O-24008 includes Portable Bluetooth Speaker 20W.', link: '/supplier/orders', read: false, at: daysAgo(1, 2) },
  { id: 'TS-N-006', audience: 'role:admin', type: 'orders', title: 'Weekly summary', body: 'Review this week’s marketplace activity in Reports.', link: '/admin/reports', read: false, at: daysAgo(1) },
];

export default notifications;
