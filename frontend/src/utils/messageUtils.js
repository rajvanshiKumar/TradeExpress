/**
 * Resolves which side of a conversation the signed-in user is on.
 * Robust case-insensitivity: 'supplier' / 'SUPPLIER' -> 'supplier', otherwise 'buyer'.
 *
 * @param {Object|null} user - Current user object
 * @returns {'supplier'|'buyer'}
 */
export function sideFor(user) {
  return String(user?.role || '').toLowerCase() === 'supplier' ? 'supplier' : 'buyer';
}

/**
 * Checks whether an incoming message belongs to the active user.
 *
 * @param {Object} message
 * @param {Object|null} user
 * @param {'buyer'|'supplier'|'admin'} side
 * @returns {boolean}
 */
export function isMyMessage(message, user, side) {
  if (!user || !message) return false;
  if (user.role === 'admin' || user.role === 'super_admin') return false;
  return message.from === side || message.senderId === user.id;
}

