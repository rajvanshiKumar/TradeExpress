/**
 * "My Quotes" sidebar badge: counts supplier quotes the buyer has not looked at yet.
 * Opening My Quotes marks every current quote as seen; a new quote or a supplier counter-offer
 * (a new negotiation round) shows up again.
 */

const CLOSED_STATUSES = ['Closed', 'Accepted', 'Declined'];

export const seenQuotesStorageKey = (userId) => `tradesphere:v3:seen-quotes:${userId || 'default'}`;

/** Identifies one supplier offer: the request, the quotation and its negotiation round. */
export const quoteSeenKey = (inquiry) =>
  `${inquiry.id}:${inquiry.quote?.id || 'quote'}:${inquiry.quote?.round || 1}`;

/** Open requests of this buyer whose latest offer came from the supplier (needs the buyer's attention). */
export const quotesAwaitingBuyer = (inquiries = [], userId) =>
  (inquiries || []).filter(
    (inquiry) =>
      inquiry &&
      userId &&
      inquiry.buyerId === userId &&
      inquiry.quote &&
      !CLOSED_STATUSES.includes(inquiry.status) &&
      inquiry.quote.lastProposedBy !== 'BUYER'
  );

export const unseenQuotesCount = (inquiries, userId, seenKeys = []) => {
  const seen = new Set(seenKeys);
  return quotesAwaitingBuyer(inquiries, userId).filter((inquiry) => !seen.has(quoteSeenKey(inquiry))).length;
};

/** Seen keys after opening My Quotes: every quote currently awaiting the buyer is marked seen. */
export const markQuotesSeen = (inquiries, userId, seenKeys = []) => {
  const next = new Set(seenKeys);
  quotesAwaitingBuyer(inquiries, userId).forEach((inquiry) => next.add(quoteSeenKey(inquiry)));
  return next.size === seenKeys.length ? seenKeys : [...next];
};

export function readSeenQuotes(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(seenQuotesStorageKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSeenQuotes(userId, keys) {
  try {
    localStorage.setItem(seenQuotesStorageKey(userId), JSON.stringify(keys));
  } catch {
    // Storage unavailable (private mode): the badge simply resets on the next visit
  }
}
