/**
 * "Saved Products" sidebar badge: counts products the buyer saved since they last opened
 * Saved Products. Opening the page marks every currently saved product as seen.
 */

export const seenSavedStorageKey = (userId) => `tradesphere:v1:seen-saved-products:${userId || 'default'}`;

export const unseenSavedCount = (productIds = [], seenIds = []) => {
  const seen = new Set(seenIds);
  return productIds.filter((id) => !seen.has(id)).length;
};

/** Seen ids after opening Saved Products: exactly the products saved right now. */
export const markSavedSeen = (productIds = []) => [...productIds];

export function readSeenSaved(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(seenSavedStorageKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSeenSaved(userId, ids) {
  try {
    localStorage.setItem(seenSavedStorageKey(userId), JSON.stringify(ids));
  } catch {
    // Storage unavailable (private mode): the badge simply resets on the next visit
  }
}
