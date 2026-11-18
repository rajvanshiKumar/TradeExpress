/**
 * Supplier "Buyer RFQs" sidebar badge: open RFQs the supplier has not seen yet.
 * Opening Buyer RFQs marks them all as seen. An RFQ shows again only when the buyer
 * makes a new counter-offer (the supplier's own replies never re-trigger it).
 */

/** Seen key: the RFQ itself, plus the round when the latest move is the buyer's counter-offer. */
export const rfqSeenKey = (inquiry) => {
  const quote = inquiry?.quote;
  return quote && quote.lastProposedBy === 'BUYER' ? `${inquiry.id}:buyer-round-${quote.round ?? 1}` : String(inquiry?.id);
};

export const unseenRfqCount = (openInquiries = [], seenKeys = []) => {
  const seen = new Set(seenKeys);
  return openInquiries.filter((inquiry) => !seen.has(rfqSeenKey(inquiry))).length;
};

/** Seen keys after opening Buyer RFQs: earlier keys plus every open RFQ as it is now. */
export const markRfqsSeen = (openInquiries = [], seenKeys = []) => [...new Set([...seenKeys, ...openInquiries.map(rfqSeenKey)])];

export const seenRfqStorageKey = (userId) => `tradesphere:v1:seen-supplier-rfqs:${userId || 'default'}`;

export function readSeenRfqs(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(seenRfqStorageKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSeenRfqs(userId, keys) {
  try {
    localStorage.setItem(seenRfqStorageKey(userId), JSON.stringify(keys));
  } catch {
    // Storage unavailable (private mode): the badge simply resets on the next visit
  }
}
