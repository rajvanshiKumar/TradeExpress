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
      content: true,
      isAutomated: true,
      isRead: true,
      readAt: true,
      createdAt: true,
    },
  },
};

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
    supplierName: conv.supplier?.name || conv.supplier?.company || 'Supplier',
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

  return null;
}

/**
 * Creates or retrieves an existing conversation between a buyer and supplier.
 */
export async function createOrGetConversation({
  buyerId,
  supplierId,
  companyId,
  productId,
  rfqId,
  orderId,
  subject,
  initialMessage,
}) {
  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
    select: { id: true, name: true, role: true, isActive: true },
  });

  if (!buyer) {
    const err = new Error('Authenticated buyer user not found.');
    err.status = 404;
    err.statusCode = 404;
    throw err;
  }

  const supplier = await resolveSupplier({ productId, supplierId, companyId });
  if (!supplier) {
    const err = new Error('Target supplier could not be identified.');
    err.status = 404;
    err.statusCode = 404;
    throw err;
  }

  if (supplier.id === buyerId) {
    const err = new Error('You cannot start a conversation with yourself.');
    err.status = 400;
    err.statusCode = 400;
    throw err;
  }

  // Fetch product name for default subject if product ID exists
  let defaultSubject = subject;
  if (!defaultSubject && productId) {
    const prod = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, companyId: true },
    });
    if (prod) {
      defaultSubject = `Inquiry: ${prod.name}`;
      if (!companyId) companyId = prod.companyId;
    }
  }

  if (!defaultSubject) {
    defaultSubject = `Inquiry for ${supplier.company || supplier.name}`;
  }

  // Run in a transaction to prevent race conditions on duplicate creation
  const result = await prisma.$transaction(async (tx) => {
    // Check if an existing conversation exists for this buyer, supplier, and product context
    const existing = await tx.conversation.findFirst({
      where: {
        buyerId,
        supplierId: supplier.id,
        productId: productId || null,
        rfqId: rfqId || null,
        orderId: orderId || null,
      },
      include: conversationInclude,
    });

    if (existing) {
      // If an initial message was sent, append it to the existing conversation
      if (initialMessage && initialMessage.trim()) {
        const cleanText = initialMessage.trim();
        await tx.message.create({
          data: {
            conversationId: existing.id,
            senderId: buyerId,
            senderRole: buyer.role,
            content: cleanText,
          },
        });

        const updated = await tx.conversation.update({
          where: { id: existing.id },
          data: {
            unreadSupplier: { increment: 1 },
            lastMessageAt: new Date(),
          },
          include: conversationInclude,
        });

        return { conversation: updated, isNew: false };
      }

      return { conversation: existing, isNew: false };
    }

    // Create new conversation
    const newConv = await tx.conversation.create({
      data: {
        buyerId,
        supplierId: supplier.id,
        companyId: companyId || supplier.company || null,
        productId: productId || null,
        rfqId: rfqId || null,
        orderId: orderId || null,
        subject: defaultSubject,
        unreadBuyer: 0,
        unreadSupplier: initialMessage && initialMessage.trim() ? 1 : 0,
        lastMessageAt: new Date(),
        messages: initialMessage && initialMessage.trim()
          ? {
              create: {
                senderId: buyerId,
                senderRole: buyer.role,
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
    where.buyerId = userId;
  } else if (role === 'SUPPLIER') {
    where.supplierId = userId;
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

  return rawConversations.map(formatConversation);
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
