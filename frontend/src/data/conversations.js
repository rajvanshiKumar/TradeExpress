// Seeded simulated conversations. Nothing here was sent to or received from a real person.

import { daysAgo } from '../utils/formatDate.js';

const thread = (id, buyerId, buyerName, companyId, productId, subject, unread, lines) => ({
  id, isSample: true, buyerId, buyerName, companyId, productId, subject, unread,
  messages: lines.map(([from, text, days, hours], index) => ({ id: `${id}-M${index + 1}`, from, text, at: daysAgo(days, hours) })),
});

const conversations = [
  thread('TS-C-1001', 'TS-U-001', 'Aarav Mehta', 'TS-CO-001', 'TS-P-1001', 'Wireless headphones: custom logo', { buyer: 1, supplier: 0 }, [
    ['buyer', 'Hello, can you print our logo on both ear cups for an order of 2,000 pieces?', 3, 5],
    ['supplier', 'Yes, we support pad printing and laser engraving. Could you share the artwork in vector format?', 3, 3],
    ['buyer', 'Sending the artwork today. What is the sample lead time?', 2, 6],
    ['supplier', 'Samples take 5 to 7 days. We have also updated your quote with the logo cost included.', 0, 4],
  ]),
  thread('TS-C-1002', 'TS-U-001', 'Aarav Mehta', 'TS-CO-006', 'TS-P-1027', 'Kraft bags: print options', { buyer: 0, supplier: 1 }, [
    ['buyer', 'Do you offer two-colour printing on the kraft shopping bags?', 5, 2],
    ['supplier', 'We do. Two colours adds about 8% to the unit price at 20,000 pieces.', 5, 1],
    ['buyer', 'Understood. Please confirm the carton size and the number of bags per carton.', 1, 3],
  ]),
  thread('TS-C-1003', 'TS-U-001', 'Aarav Mehta', 'TS-CO-009', 'TS-P-1044', 'Office chairs: packing', { buyer: 0, supplier: 0 }, [
    ['buyer', 'Are the ergonomic chairs shipped flat-packed or assembled?', 8, 4],
    ['supplier', 'Flat-packed, one chair per carton, with an assembly guide and tools included.', 8, 2],
  ]),
  thread('TS-C-1004', 'TS-U-004', 'Sofia Martins', 'TS-CO-002', 'TS-P-1008', 'Hoodies: colour card', { buyer: 0, supplier: 1 }, [
    ['buyer', 'Could you send your fleece colour card? We need five colours.', 4, 6],
    ['supplier', 'Of course. We stock 24 standard colours and can dye to a Pantone reference above 500 pieces.', 4, 4],
    ['buyer', 'Great, please also confirm embroidery pricing for a chest logo.', 2, 2],
  ]),
  thread('TS-C-1005', 'TS-U-006', 'Emma Clarke', 'TS-CO-001', 'TS-P-1002', 'Earbuds: sample order', { buyer: 0, supplier: 1 }, [
    ['buyer', 'Can I order ten sample units of the true wireless earbuds before a bulk order?', 1, 8],
  ]),
];

export default conversations;
