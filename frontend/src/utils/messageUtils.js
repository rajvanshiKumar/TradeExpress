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
 * Normalizes a supplier/company name to a standard slug for deduplication.
 * Handles common phonetic/casing variations (e.g. 'Interprises' vs 'Enterprises').
 *
 * @param {string} name
 * @returns {string}
 */
export function normalizeSupplierName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/^inquiry\s+(?:for|regarding|:)\s+/i, '')
    .replace(/\binterprises\b/g, 'enterprises')
    .replace(/\binterprise\b/g, 'enterprise')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Extracts target entity name from a subject like "Inquiry for Ramu Interprises".
 *
 * @param {string} subject
 * @returns {string}
 */
export function extractSubjectTarget(subject) {
  if (!subject || typeof subject !== 'string') return '';
  const match = subject.match(/^inquiry\s+(?:for|regarding|:)\s+(.+)$/i);
  if (!match) return '';
  const target = match[1].trim();
  if (target.toLowerCase() === 'supplier') return '';
  return target;
}

/**
 * Resolves a unique key for the counterparty of a conversation.
 * Groups duplicate conversation threads for the same buyer-supplier pair into a single clean thread.
 *
 * @param {Object} conv - Conversation object
 * @param {'buyer'|'supplier'|'admin'} side - Current user perspective
 * @param {Function} [getCompany] - Optional company lookup helper
 * @param {Object} [aliasMap] - Optional multi-pass alias map
 * @returns {string} Unique counterparty key
 */
export function getCounterpartyKey(conv, side = 'buyer', getCompany = () => null, aliasMap = null) {
  if (!conv) return 'unknown';

  if (side === 'supplier') {
    const buyerKey = conv.buyerId || conv.buyer?.id || conv.buyerName || conv.buyer?.email;
    return buyerKey ? `buyer_${buyerKey}` : `conv_${conv.id}`;
  }

  // Buyer or Admin perspective: group by supplier/company
  const company = conv.companyId && getCompany ? getCompany(conv.companyId) : null;
  const directCompany = conv.supplier?.company || company?.name || conv.supplierCompanyName;
  const subjectTarget = extractSubjectTarget(conv.subject);
  const rawCompany = directCompany || subjectTarget || (conv.supplierName !== 'Supplier' ? conv.supplierName : '');
  let normCompany = normalizeSupplierName(rawCompany);

  // If aliasMap provided, resolve through known aliases
  if ((!normCompany || normCompany === 'supplier') && aliasMap) {
    const suppId = conv.supplierId || conv.supplier?.id || company?.supplierId;
    if (suppId && aliasMap.idToCompany?.has(String(suppId))) {
      normCompany = aliasMap.idToCompany.get(String(suppId));
    } else if (conv.companyId && aliasMap.compIdToCompany?.has(String(conv.companyId))) {
      normCompany = aliasMap.compIdToCompany.get(String(conv.companyId));
    } else {
      const contact = conv.supplier?.name || conv.supplierContactName;
      if (contact && aliasMap.contactToCompany?.has(normalizeSupplierName(contact))) {
        normCompany = aliasMap.contactToCompany.get(normalizeSupplierName(contact));
      }
    }
  }

  if (normCompany && normCompany !== 'supplier') {
    return `company_${normCompany}`;
  }

  const suppUserId = conv.supplierId || conv.supplier?.id || company?.supplierId;
  if (suppUserId) return `supp_${suppUserId}`;

  const compId = conv.companyId || company?.id;
  if (compId) return `comp_${compId}`;

  const pName = (conv.supplier?.name || conv.supplierContactName || '').trim().toLowerCase();
  if (pName && pName !== 'supplier') return `contact_${normalizeSupplierName(pName)}`;

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

  // Pass 1: Build cross-reference alias map across all conversations for this perspective
  const idToCompany = new Map();
  const compIdToCompany = new Map();
  const contactToCompany = new Map();

  for (const conv of conversations) {
    if (!conv) continue;
    const company = conv.companyId && getCompany ? getCompany(conv.companyId) : null;
    const directCompany = conv.supplier?.company || company?.name || conv.supplierCompanyName;
    const subjectTarget = extractSubjectTarget(conv.subject);
    const rawCompany = directCompany || subjectTarget || (conv.supplierName !== 'Supplier' ? conv.supplierName : '');
    const norm = normalizeSupplierName(rawCompany);

    if (norm && norm !== 'supplier') {
      const suppId = conv.supplierId || conv.supplier?.id || company?.supplierId;
      if (suppId) idToCompany.set(String(suppId), norm);
      const compId = conv.companyId || company?.id;
      if (compId) compIdToCompany.set(String(compId), norm);
      const contact = conv.supplier?.name || conv.supplierContactName;
      if (contact && contact.toLowerCase() !== 'supplier') {
        contactToCompany.set(normalizeSupplierName(contact), norm);
      }
    }
  }

  const aliasMap = { idToCompany, compIdToCompany, contactToCompany };
  const partyMap = new Map();

  // Pass 2: Group and merge conversations
  for (const conv of conversations) {
    if (!conv) continue;
    const partyKey = getCounterpartyKey(conv, side, getCompany, aliasMap);

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

      // Preserve rich supplier object if one has company/name and the other lacks it
      const bestSupplier =
        primary.supplier?.company || primary.supplier?.name
          ? primary.supplier
          : secondary.supplier || primary.supplier || null;

      partyMap.set(partyKey, {
        ...secondary,
        ...primary,
        id: primary.id,
        mergedIds: [...new Set([...(existing.mergedIds || []), conv.id])],
        subject: bestSubject || primary.subject || secondary.subject || 'Inquiry',
        messages: mergedMessages,
        companyId: primary.companyId || secondary.companyId || null,
        supplierId: primary.supplierId || secondary.supplierId || null,
        supplier: bestSupplier,
        supplierName: primary.supplierName || bestSupplier?.company || bestSupplier?.name || secondary.supplierName || 'Supplier',
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
