import * as ticketService from '../services/ticketService.js';

export async function createTicket(req, res, next) {
  try {
    const userId = req.user?.id || req.body.userId;
    const { subject, category, priority, message } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User must be authenticated to create a ticket.' });
    }

    const ticket = await ticketService.createTicket({
      userId,
      subject,
      category,
      priority,
      message,
    });

    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully.',
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTickets(req, res, next) {
  try {
    const userId = req.user?.id || req.query.userId;
    const isAdmin = req.user?.role === 'ADMIN' || req.query.admin === 'true';

    if (isAdmin) {
      const { status, category, priority, search, page, limit } = req.query;
      const result = await ticketService.getAllTickets({
        status,
        category,
        priority,
        search,
        page,
        limit,
      });
      return res.json({ success: true, data: result });
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User ID is required.' });
    }

    const tickets = await ticketService.getUserTickets(userId);
    res.json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTicketById(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.query.userId;
    const isAdmin = req.user?.role === 'ADMIN' || req.query.admin === 'true';

    const ticket = await ticketService.getTicketById(id, userId, isAdmin);
    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
}

export async function addMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { message, senderRole } = req.body;
    const role = senderRole || (req.user?.role === 'ADMIN' ? 'ADMIN' : 'USER');

    const created = await ticketService.addTicketMessage({
      ticketId: id,
      senderRole: role,
      message,
      userId: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: 'Message added to ticket.',
      data: created,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await ticketService.updateTicketStatus(id, status);
    res.json({
      success: true,
      message: `Ticket status updated to ${status}.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}
