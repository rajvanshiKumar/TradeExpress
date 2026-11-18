import prisma from '../config/db.js';

const conversationInclude = {
  buyer: {
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      phone: true,
      city: true,
      country: true,
      role: true,
    },
  },
  supplier: {
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      phone: true,
      city: true,
      country: true,
      role: true,
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      photo: true,
      sku: true,
      price: true,
      currency: true,
      unit: true,
      companyId: true,
      supplierId: true,
    },
  },
  rfq: {
    select: {
      id: true,
      rfqNumber: true,
      title: true,
      status: true,
    },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      orderStatus: true,
      total: true,
    },
  },
  messages: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      senderRole: true,
      sender: {
        select: {
          id: true,
          name: true,
          company: true,
          role: true,
        },
      },
      content: true,
      isAutomated: true,
      isRead: true,
      readAt: true,
      createdAt: true,
    },
  },
};

function normalizeEntitySlug(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/^inquiry\s+(?:for|regarding|:)\s+/i, '')
    .replace(/\binterprises\b/g, 'enterprises')
    .replace(/\binterprise\b/g, 'enterprise')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes message object for consistent frontend consumption.
 */
export function formatMessage(msg) {
  if (!msg) return null;
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    senderRole: msg.senderRole,
    senderName: msg.sender?.name || null,
    senderCompany: msg.sender?.company || null,
    sender: msg.sender || null,
    from: msg.senderRole ? msg.senderRole.toLowerCase() : 'buyer',
    text: msg.content,
    content: msg.content,
    automated: Boolean(msg.isAutomated),
    isAutomated: Boolean(msg.isAutomated),
    isRead: Boolean(msg.isRead),
    readAt: msg.readAt,
    at: msg.createdAt,
    createdAt: msg.createdAt,
  };
}

/**
 * Normalizes conversation object for consistent frontend consumption.
 */
export function formatConversation(conv) {
  if (!conv) return null;
  const messages = (conv.messages || []).map(formatMessage);
  return {
    id: conv.id,
    buyerId: conv.buyerId,
    buyerName: conv.buyer?.name || 'Buyer',
    buyer: conv.buyer,
    supplierId: conv.supplierId,
    supplierName: conv.supplier?.company || conv.supplier?.name || 'Supplier',
    supplierCompanyName: conv.supplier?.company || null,
    supplierContactName: conv.supplier?.name || null,
    supplier: conv.supplier,
    companyId: conv.companyId || conv.product?.companyId || null,
    productId: conv.productId,
    product: conv.product,
    rfqId: conv.rfqId,
    rfq: conv.rfq,
    orderId: conv.orderId,
    order: conv.order,
    subject: conv.subject,
    unreadBuyer: conv.unreadBuyer || 0,
    unreadSupplier: conv.unreadSupplier || 0,
    unread: {
      buyer: conv.unreadBuyer || 0,
      supplier: conv.unreadSupplier || 0,
    },
    lastMessageAt: conv.lastMessageAt || conv.createdAt,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messages,
  };
}

/**
 * Resolves a supplier user based on productId, supplierId, or companyId.
 */
async function resolveSupplier({ productId, supplierId, companyId }) {
  // 1. If product ID is provided, fetch product to inspect its supplierId / companyId
  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, supplierId: true, companyId: true, name: true },
    });
    if (product) {
      if (product.supplierId) {
        const supplierUser = await prisma.user.findUnique({
          where: { id: product.supplierId },
        });
        if (supplierUser) return supplierUser;
      }
      if (product.companyId) {
        companyId = product.companyId;
      }
    }
  }

  // 2. If direct supplierId provided
  if (supplierId) {
    const supplierUser = await prisma.user.findFirst({
      where: {
        id: supplierId,
        role: { in: ['SUPPLIER', 'ADMIN', 'SUPER_ADMIN'] },
      },
    });
    if (supplierUser) return supplierUser;
  }

  // 3. If companyId provided (e.g. 'TS-CO-001')
  if (companyId) {
    // Check if any product has this companyId and a linked supplierId
    const productWithSupplier = await prisma.product.findFirst({
      where: { companyId, supplierId: { not: null } },
      select: { supplierId: true },
    });
    if (productWithSupplier?.supplierId) {
      const supplierUser = await prisma.user.findUnique({
        where: { id: productWithSupplier.supplierId },
      });
      if (supplierUser) return supplierUser;
    }

    // Check if user has this company name or email pattern
    const supplierUser = await prisma.user.findFirst({
      where: {
        role: 'SUPPLIER',
        OR: [
          { company: { contains: companyId } },
          { email: { contains: companyId.toLowerCase() } },
        ],
      },
    });
    if (supplierUser) return supplierUser;
  }

  // Fallback: If not resolved to a specific supplier user, assign to any active supplier user
  const fallbackSupplier = await prisma.user.findFirst({
    where: { role: 'SUPPLIER', isActive: true },
  });
  if (fallbackSupplier) return fallbackSupplier;

  return null;
}

/**
 * Turns the client's context references into real records, so the conversation only links rows that exist.
 * Products match by id or slug (catalogue pages may carry a display id). Orders and RFQs link only when they
 * belong to this buyer; anything that does not resolve is left off instead of failing the chat.
 */
async function resolveConversationLinks({ buyerId, productId, productSlug, rfqId, orderId }) {
  const productKeys = [productId, productSlug].filter((key) => typeof key === 'string' && key.trim());
  const [product, rfq, order] = await Promise.all([
    productKeys.length
      ? prisma.product.findFirst({
        where: { OR: productKeys.flatMap((key) => [{ id: key }, { slug: key }]) },
        select: { id: true, name: true, companyId: true, supplierId: true },
      })
      : null,
    rfqId
      ? prisma.rfq.findFirst({
        where: {
          OR: [{ id: String(rfqId) }, { rfqNumber: String(rfqId) }],
          ...(buyerId ? { buyerId } : {}),
        },
        select: { id: true, rfqNumber: true, buyerId: true, title: true },
      })
      : null,
    orderId
      ? prisma.order.findFirst({
        where: {
          OR: [{ id: String(orderId) }, { orderNumber: String(orderId) }],
          ...(buyerId ? { userId: buyerId } : {}),
        },
        select: { id: true, orderNumber: true, userId: true },
      })
      : null,
  ]);
  return {
    productId: product?.id || null,
    product,
    rfqId: rfq?.id || null,
    rfq,
    orderId: order?.id || null,
    order,
  };
}

/**
 * Creates or retrieves an existing conversation between a buyer and supplier.
 */
export async function createOrGetConversation({
  callerUser,
  buyerId,
  supplierId,
  companyId,
  productId: requestedProductId,
  productSlug,
  rfqId: requestedRfqId,
  orderId: requestedOrderId,
  subject,
  initialMessage,
}) {
  let resolvedBuyerId = buyerId;
  let resolvedSupplierId = supplierId;

  // Auto-resolve buyer from RFQ or Order if not provided
  if (!resolvedBuyerId && requestedRfqId) {
    const rfqRec = await prisma.rfq.findFirst({
      where: { OR: [{ id: String(requestedRfqId) }, { rfqNumber: String(requestedRfqId) }] },
      select: { id: true, buyerId: true },
    });
    if (rfqRec?.buyerId) resolvedBuyerId = rfqRec.buyerId;
  }

  if (!resolvedBuyerId && requestedOrderId) {
    const orderRec = await prisma.order.findFirst({
      where: { OR: [{ id: String(requestedOrderId) }, { orderNumber: String(requestedOrderId) }] },
      select: { id: true, userId: true },
    });
    if (orderRec?.userId) resolvedBuyerId = orderRec.userId;
  }

  if (!resolvedBuyerId) {
    const err = new Error('Target buyer could not be identified. Provide buyer ID or link an RFQ/order.');
    err.status = 400;
    err.statusCode = 400;
    throw err;
  }

  const buyer = await prisma.user.findUnique({
    where: { id: resolvedBuyerId },
    select: { id: true, name: true, role: true, isActive: true },
  });

  if (!buyer) {
    const err = new Error('Target buyer user not found.');
    err.status = 404;
    err.statusCode = 404;
    throw err;
  }

  const { productId, product, rfqId, rfq, orderId, order } = await resolveConversationLinks({
    buyerId: resolvedBuyerId,
    productId: requestedProductId,
    productSlug,
    rfqId: requestedRfqId,
    orderId: requestedOrderId,
  });

  let supplier = null;
  if (callerUser?.role === 'SUPPLIER' && resolvedBuyerId !== callerUser.id && !resolvedSupplierId && !companyId) {
    supplier = await prisma.user.findUnique({
      where: { id: callerUser.id },
      select: { id: true, name: true, company: true, role: true, isActive: true },
    });
  }

  if (!supplier) {
    supplier = await resolveSupplier({ productId, supplierId: resolvedSupplierId, companyId });
  }

  if (!supplier) {
    const err = new Error('Target supplier could not be identified.');
    err.status = 404;
    err.statusCode = 404;
    throw err;
  }

  if (supplier.id === resolvedBuyerId) {
    const err = new Error('You cannot start a conversation with yourself.');
    err.status = 400;
    err.statusCode = 400;
    throw err;
  }

  // Fetch subject
  let defaultSubject = subject;
  if (!defaultSubject && product?.name) {
    defaultSubject = `Inquiry: ${product.name}`;
    if (!companyId && product.companyId) companyId = product.companyId;
  } else if (!defaultSubject && rfq?.rfqNumber) {
    defaultSubject = `Inquiry regarding RFQ ${rfq.rfqNumber}`;
  } else if (!defaultSubject && order?.orderNumber) {
    defaultSubject = `Inquiry regarding Order ${order.orderNumber}`;
  }

  if (!defaultSubject) {
    defaultSubject = `Inquiry for ${supplier.company || supplier.name}`;
  }

  // Determine who sends the initial message
  const senderId = callerUser ? callerUser.id : resolvedBuyerId;
  const senderRole = callerUser ? callerUser.role : (buyer.role || 'BUYER');
  const isSenderBuyer = senderId === resolvedBuyerId;

  // Run in a transaction to prevent race conditions on duplicate creation
  const result = await prisma.$transaction(async (tx) => {
    // 1. Check if an exact matching conversation exists for this buyer, supplier, and context
    let existing = null;
    if (productId || rfqId || orderId) {
      existing = await tx.conversation.findFirst({
        where: {
          buyerId: resolvedBuyerId,
          supplierId: supplier.id,
          ...(productId ? { productId } : {}),
          ...(rfqId ? { rfqId } : {}),
          ...(orderId ? { orderId } : {}),
        },
        include: conversationInclude,
        orderBy: { lastMessageAt: 'desc' },
      });
    }

    // 2. If no exact context match, reuse ANY existing conversation between this buyer and supplier
    if (!existing) {
      const companyName = (supplier.company || '').trim();
      const contactName = (supplier.name || '').trim();
      const altCompany = companyName.includes('Interprises')
        ? companyName.replace(/Interprises/g, 'Enterprises')
        : companyName.replace(/Enterprises/g, 'Interprises');

      existing = await tx.conversation.findFirst({
        where: {
          buyerId: resolvedBuyerId,
          OR: [
            { supplierId: supplier.id },
            ...(companyId ? [{ companyId }] : []),
            ...(companyName ? [
              { companyId: companyName },
              { supplier: { company: { equals: companyName } } },
              { subject: { contains: companyName } },
            ] : []),
            ...(altCompany && altCompany !== companyName ? [
              { companyId: altCompany },
              { supplier: { company: { equals: altCompany } } },
              { subject: { contains: altCompany } },
            ] : []),
            ...(contactName ? [
              { supplier: { name: { equals: contactName } } },
            ] : []),
          ],
        },
        include: conversationInclude,
        orderBy: { lastMessageAt: 'desc' },
      });
    }

    if (existing) {
      const updateData = {};
      if (!existing.productId && productId) updateData.productId = productId;
      if (!existing.rfqId && rfqId) updateData.rfqId = rfqId;
      if (!existing.orderId && orderId) updateData.orderId = orderId;
      if (!existing.companyId && (companyId || supplier.company)) updateData.companyId = companyId || supplier.company;

      if (initialMessage && initialMessage.trim()) {
        const cleanText = initialMessage.trim();
        await tx.message.create({
          data: {
            conversationId: existing.id,
            senderId,
            senderRole,
            content: cleanText,
          },
        });

        updateData.lastMessageAt = new Date();
        if (isSenderBuyer) {
          updateData.unreadSupplier = { increment: 1 };
        } else {
          updateData.unreadBuyer = { increment: 1 };
        }
      }

      if (Object.keys(updateData).length > 0) {
        const updated = await tx.conversation.update({
          where: { id: existing.id },
          data: updateData,
          include: conversationInclude,
        });

        return { conversation: updated, isNew: false };
      }

      return { conversation: existing, isNew: false };
    }

    // Create new conversation
    const newConv = await tx.conversation.create({
      data: {
        buyerId: resolvedBuyerId,
        supplierId: supplier.id,
        companyId: companyId || supplier.company || null,
        productId: productId || null,
        rfqId: rfqId || null,
        orderId: orderId || null,
        subject: defaultSubject,
        unreadBuyer: !isSenderBuyer && initialMessage && initialMessage.trim() ? 1 : 0,
        unreadSupplier: isSenderBuyer && initialMessage && initialMessage.trim() ? 1 : 0,
        lastMessageAt: new Date(),
        messages: initialMessage && initialMessage.trim()
          ? {
            create: {
              senderId,
              senderRole,
              content: initialMessage.trim(),
            },
          }
          : undefined,
      },
      include: conversationInclude,
    });

    return { conversation: newConv, isNew: true };
  });

  return {
    ...result,
    conversation: formatConversation(result.conversation),
  };
}

/**
 * List conversations accessible by the authenticated user.
 */
export async function listConversations(userId, role, search = '') {
  const where = {};

  if (role === 'BUYER') {
    where.OR = [{ buyerId: userId }, { supplierId: userId }];
  } else if (role === 'SUPPLIER') {
    where.OR = [{ supplierId: userId }, { buyerId: userId }];
  } else if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    // Fallback for safety: user must participate
    where.OR = [{ buyerId: userId }, { supplierId: userId }];
  }

  if (search && search.trim()) {
    const term = search.trim();
    where.AND = [
      {
        OR: [
          { subject: { contains: term } },
          { buyer: { name: { contains: term } } },
          { buyer: { company: { contains: term } } },
          { supplier: { name: { contains: term } } },
          { supplier: { company: { contains: term } } },
          { product: { name: { contains: term } } },
          { messages: { some: { content: { contains: term } } } },
        ],
      },
    ];
  }

  const rawConversations = await prisma.conversation.findMany({
    where,
    include: conversationInclude,
    orderBy: { lastMessageAt: 'desc' },
  });

  // Pass 1: Build cross-reference alias maps for robust supplier identity resolution
  const idToCompany = new Map();
  const compIdToCompany = new Map();
  const contactToCompany = new Map();

  for (const conv of rawConversations) {
    const rawCompany = conv.supplier?.company || conv.companyId || '';
    const norm = normalizeEntitySlug(rawCompany);
    if (norm && norm !== 'supplier') {
      if (conv.supplierId) idToCompany.set(String(conv.supplierId), norm);
      if (conv.companyId) compIdToCompany.set(String(conv.companyId), norm);
      if (conv.supplier?.name) contactToCompany.set(normalizeEntitySlug(conv.supplier.name), norm);
    }
  }

  // Pass 2: Consolidate conversations between the same buyer and supplier so only one clean thread appears
  const partyMap = new Map();
  const duplicateEmptyIds = [];
  const duplicateWithMessages = [];

  for (const conv of rawConversations) {
    let normSupplier = normalizeEntitySlug(conv.supplier?.company || '');
    if (!normSupplier || normSupplier === 'supplier') {
      if (conv.supplierId && idToCompany.has(String(conv.supplierId))) {
        normSupplier = idToCompany.get(String(conv.supplierId));
      } else if (conv.companyId && compIdToCompany.has(String(conv.companyId))) {
        normSupplier = compIdToCompany.get(String(conv.companyId));
      } else if (conv.supplier?.name && contactToCompany.has(normalizeEntitySlug(conv.supplier.name))) {
        normSupplier = contactToCompany.get(normalizeEntitySlug(conv.supplier.name));
      } else {
        normSupplier = normalizeEntitySlug(conv.subject || '');
      }
    }

    const pairKey = `${conv.buyerId}_${normSupplier || conv.supplierId || 'supplier'}`;
    if (!partyMap.has(pairKey)) {
      partyMap.set(pairKey, {
        ...conv,
        mergedIds: [conv.id],
        messages: Array.isArray(conv.messages) ? conv.messages : [],
      });
    } else {
      const existing = partyMap.get(pairKey);
      const existingMsgs = (existing.messages || []).length;
      const currentMsgs = (conv.messages || []).length;

      // Merge messages from both
      const msgMap = new Map();
      (existing.messages || []).forEach((m) => msgMap.set(m.id, m));
      (conv.messages || []).forEach((m) => msgMap.set(m.id, m));
      const mergedMessages = Array.from(msgMap.values()).sort(
        (a, b) => new Date(a.createdAt || a.at || 0) - new Date(b.createdAt || b.at || 0)
      );

      // Choose richer base object
      const preferConv =
        currentMsgs > existingMsgs ||
        (currentMsgs === existingMsgs &&
          new Date(conv.lastMessageAt || conv.createdAt || 0) >
          new Date(existing.lastMessageAt || existing.createdAt || 0));
      const primary = preferConv ? conv : existing;
      const secondary = preferConv ? existing : conv;

      if ((secondary.messages || []).length === 0) {
        duplicateEmptyIds.push(secondary.id);
      } else {
        duplicateWithMessages.push({ fromId: secondary.id, toId: primary.id });
      }

      let bestSubject = primary.subject;
      if (
        (!bestSubject || bestSubject.toLowerCase() === 'inquiry for supplier') &&
        secondary.subject &&
        secondary.subject.toLowerCase() !== 'inquiry for supplier'
      ) {
        bestSubject = secondary.subject;
      }

      partyMap.set(pairKey, {
        ...secondary,
        ...primary,
        id: primary.id,
        mergedIds: [...new Set([...(existing.mergedIds || []), conv.id])],
        subject: bestSubject || primary.subject || 'Inquiry',
        messages: mergedMessages,
        lastMessageAt: new Date(
          Math.max(
            new Date(primary.lastMessageAt || primary.createdAt || 0).getTime(),
            new Date(secondary.lastMessageAt || secondary.createdAt || 0).getTime()
          )
        ),
        unreadBuyer: (primary.unreadBuyer || 0) + (secondary.unreadBuyer || 0),
        unreadSupplier: (primary.unreadSupplier || 0) + (secondary.unreadSupplier || 0),
      });
    }
  }

  // Silently heal database by removing duplicate ghost rows
  if (duplicateEmptyIds.length > 0) {
    prisma.conversation.deleteMany({ where: { id: { in: duplicateEmptyIds } } }).catch(() => {});
  }
  if (duplicateWithMessages.length > 0) {
    for (const { fromId, toId } of duplicateWithMessages) {
      prisma.message
        .updateMany({ where: { conversationId: fromId }, data: { conversationId: toId } })
        .then(() => prisma.conversation.delete({ where: { id: fromId } }))
        .catch(() => {});
    }
  }

  const consolidated = Array.from(partyMap.values());
  return consolidated.map(formatConversation);
}

/**
 * Verifies if user has authorization to view or interact with a conversation.
 */
export async function verifyConversationAccess(conversationId, user) {
  if (!conversationId || !user) return false;
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { buyerId: true, supplierId: true },
  });

  if (!conv) return false;
  return conv.buyerId === user.id || conv.supplierId === user.id;
}

/**
 * Fetches a single conversation by ID with access verification.
 */
export async function getConversationById(conversationId, user) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });

  if (!conv) {
    const err = new Error('Conversation not found.');
    err.status = 404;
    err.statusCode = 404;
    throw err;
  }

  const isParticipant =
    user.role === 'ADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    conv.buyerId === user.id ||
    conv.supplierId === user.id;

  if (!isParticipant) {
    const err = new Error('You do not have permission to access this conversation.');
    err.status = 403;
    err.statusCode = 403;
    throw err;
  }

  // If this conversation has 0 messages, check if another conversation between the same parties has messages
  if ((!conv.messages || conv.messages.length === 0) && conv.buyerId) {
    const rawCompany = conv.supplier?.company || '';
    const norm = normalizeEntitySlug(rawCompany);
    const companion = await prisma.conversation.findFirst({
      where: {
        buyerId: conv.buyerId,
        id: { not: conv.id },
        OR: [
          ...(conv.supplierId ? [{ supplierId: conv.supplierId }] : []),
          ...(rawCompany ? [{ supplier: { company: { equals: rawCompany } } }] : []),
          ...(norm ? [{ subject: { contains: norm } }] : []),
        ],
        messages: { some: {} },
      },
      include: conversationInclude,
      orderBy: { lastMessageAt: 'desc' },
    });
    if (companion && companion.messages?.length > 0) {
      conv.messages = companion.messages;
      if (companion.subject && (!conv.subject || conv.subject.toLowerCase() === 'inquiry for supplier')) {
        conv.subject = companion.subject;
      }
      if (!conv.supplier && companion.supplier) {
        conv.supplier = companion.supplier;
      }
    }
  }

  return formatConversation(conv);
}

/**
 * Sends a message within a conversation and updates timestamps and unread counters.
 */
export async function sendMessage({ conversationId, senderId, senderRole, content, isAutomated = false }) {
  if (!content || !content.trim()) {
    const err = new Error('Message content cannot be empty.');
    err.status = 400;
    err.statusCode = 400;
    throw err;
  }

  const cleanContent = content.trim();
  if (cleanContent.length > 5000) {
    const err = new Error('Message content exceeds 5,000 character limit.');
    err.status = 400;
    err.statusCode = 400;
    throw err;
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, buyerId: true, supplierId: true },
  });

  if (!conv) {
    const err = new Error('Conversation not found.');
    err.status = 404;
    err.statusCode = 404;
    throw err;
  }

  const isParticipant =
    senderRole === 'ADMIN' ||
    senderRole === 'SUPER_ADMIN' ||
    conv.buyerId === senderId ||
    conv.supplierId === senderId;

  if (!isParticipant) {
    const err = new Error('You are not authorized to post messages to this conversation.');
    err.status = 403;
    err.statusCode = 403;
    throw err;
  }

  const isSenderBuyer = senderId === conv.buyerId;

  const result = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        conversationId,
        senderId,
        senderRole,
        content: cleanContent,
        isAutomated: Boolean(isAutomated),
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            company: true,
            role: true,
          },
        },
      },
    });

    const updateData = {
      lastMessageAt: new Date(),
    };

    if (isSenderBuyer) {
      updateData.unreadSupplier = { increment: 1 };
    } else {
      updateData.unreadBuyer = { increment: 1 };
    }

    const updatedConv = await tx.conversation.update({
      where: { id: conversationId },
      data: updateData,
      include: conversationInclude,
    });

    return { message, conversation: updatedConv };
  });

  return {
    message: formatMessage(result.message),
    conversation: formatConversation(result.conversation),
  };
}

/**
 * Marks all incoming messages in a conversation as read and resets user's unread counter.
 */
export async function markConversationRead(conversationId, userId, role) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, buyerId: true, supplierId: true, unreadBuyer: true, unreadSupplier: true },
  });

  if (!conv) {
    const err = new Error('Conversation not found.');
    err.status = 404;
    err.statusCode = 404;
    throw err;
  }

  const isBuyer = conv.buyerId === userId;
  const isSupplier = conv.supplierId === userId;

  if (!isBuyer && !isSupplier && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    const err = new Error('You do not have permission to modify this conversation.');
    err.status = 403;
    err.statusCode = 403;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    if (isBuyer) {
      if (conv.unreadBuyer > 0) {
        await tx.conversation.update({
          where: { id: conversationId },
          data: { unreadBuyer: 0 },
        });
      }
      await tx.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    } else if (isSupplier) {
      if (conv.unreadSupplier > 0) {
        await tx.conversation.update({
          where: { id: conversationId },
          data: { unreadSupplier: 0 },
        });
      }
      await tx.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }
  });

  const updated = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });

  return formatConversation(updated);
}

/**
 * Returns total unread messages count for an authenticated user.
 */
export async function getUnreadCount(userId, role) {
  if (!userId) return 0;

  if (role === 'BUYER') {
    const aggregate = await prisma.conversation.aggregate({
      where: { buyerId: userId },
      _sum: { unreadBuyer: true },
    });
    return aggregate._sum.unreadBuyer || 0;
  }

  if (role === 'SUPPLIER') {
    const aggregate = await prisma.conversation.aggregate({
      where: { supplierId: userId },
      _sum: { unreadSupplier: true },
    });
    return aggregate._sum.unreadSupplier || 0;
  }

  return 0;
}
