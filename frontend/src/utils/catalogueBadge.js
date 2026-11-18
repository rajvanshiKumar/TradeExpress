/**
 * Supplier "Product Catalogue" sidebar badge: counts products added since the supplier last
 * opened the catalogue. Opening it marks every current product as seen (same rule as the
 * buyer's Saved Products badge).
 */
export { unseenSavedCount as unseenProductCount, markSavedSeen as markProductsSeen } from './savedProductsBadge.js';

export const seenCatalogueStorageKey = (userId) => `tradesphere:v1:seen-catalogue-products:${userId || 'default'}`;

export function readSeenCatalogue(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(seenCatalogueStorageKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSeenCatalogue(userId, ids) {
  try {
    localStorage.setItem(seenCatalogueStorageKey(userId), JSON.stringify(ids));
  } catch {
    // Storage unavailable (private mode): the badge simply resets on the next visit
  }
}
