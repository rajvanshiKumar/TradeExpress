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

/**
 * Resolves a unique key for the counterparty of a conversation.
 * Groups duplicate conversation threads for the same buyer-supplier pair into a single clean thread.
 *
 * @param {Object} conv - Conversation object
 * @param {'buyer'|'supplier'|'admin'} side - Current user perspective
 * @param {Function} [getCompany] - Optional company lookup helper
 * @returns {string} Unique counterparty key
 */
export function getCounterpartyKey(conv, side = 'buyer', getCompany = () => null) {
  if (!conv) return 'unknown';

  if (side === 'supplier') {
    const buyerKey = conv.buyerId || conv.buyer?.id || conv.buyerName || conv.buyer?.email;
    return buyerKey ? `buyer_${buyerKey}` : `conv_${conv.id}`;
  }

  // Buyer or Admin perspective: group by supplier/company
  const company = conv.companyId && getCompany ? getCompany(conv.companyId) : null;
  const suppUserId = conv.supplierId || conv.supplier?.id || company?.supplierId;
  if (suppUserId) return `supp_${suppUserId}`;

  const compId = conv.companyId || company?.id;
  if (compId) return `comp_${compId}`;

  const cName = (company?.name || conv.supplier?.company || conv.supplierCompanyName || conv.supplierName || '').trim().toLowerCase();
  if (cName && cName !== 'supplier') return `name_${cName}`;

  const pName = (conv.supplier?.name || conv.supplierContactName || '').trim().toLowerCase();
  if (pName && pName !== 'supplier') return `contact_${pName}`;

  return `conv_${conv.id}`;
}

/**
 * Consolidates duplicate conversation threads between the same parties into single rich threads.
 * Merges messages deduplicated by message ID and chronologically sorted.
 *
 * @param {Array} conversations - List of raw conversations
 * @param {'buyer'|'supplier'|'admin'} [side='buyer'] - Perspective
 * @param {Function} [getCompany] - Company lookup helper
 * @returns {Array} Deduplicated, consolidated conversations
 */
export function consolidateConversations(conversations = [], side = 'buyer', getCompany = () => null) {
  if (!Array.isArray(conversations)) return [];

  const partyMap = new Map();

  for (const conv of conversations) {
    if (!conv) continue;
    const partyKey = getCounterpartyKey(conv, side, getCompany);

    const convMessages = Array.isArray(conv.messages) ? conv.messages : [];
    const convMsgCount = convMessages.length;

    if (!partyMap.has(partyKey)) {
      partyMap.set(partyKey, {
        ...conv,
        mergedIds: [conv.id],
        messages: [...convMessages],
      });
    } else {
      const existing = partyMap.get(partyKey);
      const existingMessages = Array.isArray(existing.messages) ? existing.messages : [];
      const existingMsgCount = existingMessages.length;

      // Merge messages deduplicated by id
      const msgMap = new Map();
      existingMessages.forEach((m) => msgMap.set(m.id || `${m.createdAt || m.at}_${m.text || m.content}`, m));
      convMessages.forEach((m) => msgMap.set(m.id || `${m.createdAt || m.at}_${m.text || m.content}`, m));
      const mergedMessages = Array.from(msgMap.values()).sort(
        (a, b) => new Date(a.createdAt || a.at || 0) - new Date(b.createdAt || b.at || 0)
      );

      // Choose base object: prefer the one with messages, or more recently updated
      const preferConv =
        convMsgCount > existingMsgCount ||
        (convMsgCount === existingMsgCount &&
          new Date(conv.lastMessageAt || conv.createdAt || 0) >
            new Date(existing.lastMessageAt || existing.createdAt || 0));

      const primary = preferConv ? conv : existing;
      const secondary = preferConv ? existing : conv;

      // Prioritize specific subject over generic 'Inquiry for Supplier'
      let bestSubject = primary.subject;
      if (
        (!bestSubject || bestSubject.toLowerCase() === 'inquiry for supplier') &&
        secondary.subject &&
        secondary.subject.toLowerCase() !== 'inquiry for supplier'
      ) {
        bestSubject = secondary.subject;
      }

      partyMap.set(partyKey, {
        ...secondary,
        ...primary,
        id: primary.id,
        mergedIds: [...new Set([...(existing.mergedIds || []), conv.id])],
        subject: bestSubject || primary.subject || secondary.subject || 'Inquiry',
        messages: mergedMessages,
        companyId: primary.companyId || secondary.companyId || null,
        supplierId: primary.supplierId || secondary.supplierId || null,
        supplier: primary.supplier || secondary.supplier || null,
        product: primary.product || secondary.product || null,
        productId: primary.productId || secondary.productId || null,
        lastMessageAt: new Date(
          Math.max(
            new Date(primary.lastMessageAt || primary.createdAt || 0).getTime(),
            new Date(secondary.lastMessageAt || secondary.createdAt || 0).getTime()
          )
        ).toISOString(),
        unread: {
          buyer: (primary.unread?.buyer || 0) + (secondary.unread?.buyer || 0),
          supplier: (primary.unread?.supplier || 0) + (secondary.unread?.supplier || 0),
        },
      });
    }
  }

  return Array.from(partyMap.values()).sort(
    (a, b) => new Date(b.lastMessageAt || b.createdAt || 0) - new Date(a.lastMessageAt || a.createdAt || 0)
  );
}

