import prisma from '../config/db.js';
import { createNotification, notifyUsersByRole } from './notificationService.js';

/**
 * Create a new support ticket
 */
export async function createTicket({
  userId,
  subject,
  category = 'GENERAL',
  priority = 'NORMAL',
  message,
}) {
  if (!userId || !subject || !message) {
    const error = new Error('userId, subject, and message are required.');
    error.statusCode = 400;
    throw error;
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      subject: subject.trim(),
      category: category.toUpperCase(),
      priority: priority.toUpperCase(),
      status: 'OPEN',
      messages: {
        create: {
          senderRole: 'USER',
          message: message.trim(),
        },
      },
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, company: true, role: true },
      },
      messages: true,
    },
  });

  // Notify admins
  notifyUsersByRole('ADMIN', {
    title: `New Support Ticket: ${ticket.subject}`,
    message: `${ticket.user?.name || 'A user'} opened a ticket (${ticket.category}).`,
    type: 'SUPPORT',
    link: `/admin/reports?tab=tickets&id=${ticket.id}`,
  }).catch(() => {});

  return ticket;
}

/**
 * List tickets for a specific user
 */
export async function getUserTickets(userId) {
  return prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: {
        select: { messages: true },
      },
    },
  });
}

/**
 * List all tickets (Admin view with filters)
 */
export async function getAllTickets({ status, category, priority, search, page = 1, limit = 50 } = {}) {
  const where = {};
  if (status && status !== 'ALL') where.status = status;
  if (category && category !== 'ALL') where.category = category;
  if (priority && priority !== 'ALL') where.priority = priority;

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { subject: { contains: q } },
      { user: { name: { contains: q } } },
      { user: { email: { contains: q } } },
      { user: { company: { contains: q } } },
    ];
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { updatedAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, company: true, role: true },
        },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return {
    tickets,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
}

/**
 * Get ticket details with full message thread
 */
export async function getTicketById(ticketId, requestingUserId = null, isAdmin = false) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: {
        select: { id: true, name: true, email: true, company: true, role: true },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!ticket) {
    const error = new Error('Support ticket not found.');
    error.statusCode = 404;
    throw error;
  }

  if (!isAdmin && requestingUserId && ticket.userId !== requestingUserId) {
    const error = new Error('You do not have permission to view this ticket.');
    error.statusCode = 403;
    throw error;
  }

  return ticket;
}

/**
 * Add a message to an existing ticket
 */
export async function addTicketMessage({ ticketId, senderRole = 'USER', message, userId = null }) {
  if (!ticketId || !message?.trim()) {
    const error = new Error('ticketId and message are required.');
    error.statusCode = 400;
    throw error;
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: { user: true },
  });

  if (!ticket) {
    const error = new Error('Support ticket not found.');
    error.statusCode = 404;
    throw error;
  }

  const role = senderRole.toUpperCase();
  const createdMessage = await prisma.ticketMessage.create({
    data: {
      ticketId,
      senderRole: role,
      message: message.trim(),
    },
  });

  // If admin replied, mark ticket IN_PROGRESS if OPEN, and notify the user
  let updatedStatus = ticket.status;
  if (role === 'ADMIN') {
    if (ticket.status === 'OPEN') {
      updatedStatus = 'IN_PROGRESS';
    }
    createNotification({
      userId: ticket.userId,
      title: `Support Update: ${ticket.subject}`,
      message: `TradeSphere Support replied to your ticket.`,
      type: 'SUPPORT',
      link: `/help?ticket=${ticket.id}`,
    }).catch(() => {});
  } else {
    // User replied, update ticket's updated timestamp
    notifyUsersByRole('ADMIN', {
      title: `Ticket Reply: ${ticket.subject}`,
      message: `${ticket.user?.name || 'User'} sent a message on ticket #${ticket.id.slice(0, 8)}.`,
      type: 'SUPPORT',
      link: `/admin/reports?tab=tickets&id=${ticket.id}`,
    }).catch(() => {});
  }

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: updatedStatus,
      updatedAt: new Date(),
    },
  });

  return createdMessage;
}

/**
 * Update ticket status (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
 */
export async function updateTicketStatus(ticketId, status) {
  const valid = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  const newStatus = status?.toUpperCase();

  if (!valid.includes(newStatus)) {
    const error = new Error(`Invalid status. Must be one of: ${valid.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const ticket = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: newStatus },
    include: { user: true },
  });

  createNotification({
    userId: ticket.userId,
    title: `Ticket ${newStatus}: ${ticket.subject}`,
    message: `Your support ticket has been marked as ${newStatus}.`,
    type: 'SUPPORT',
    link: `/help?ticket=${ticket.id}`,
  }).catch(() => {});

  return ticket;
}
