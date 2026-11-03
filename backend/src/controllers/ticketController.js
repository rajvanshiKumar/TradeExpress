import * as ticketService from '../services/ticketService.js';

// Identity and staff status always come from the authenticated user, never from the request.
const isStaff = (user) => user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

export async function createTicket(req, res, next) {
  try {
    const { subject, category, priority, message } = req.body;

    const ticket = await ticketService.createTicket({
      userId: req.user.id,
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
    // Staff see every ticket; everyone else sees only their own
    if (isStaff(req.user)) {
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

    const tickets = await ticketService.getUserTickets(req.user.id);
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
    const ticket = await ticketService.getTicketById(req.params.id, req.user.id, isStaff(req.user));
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
    const created = await ticketService.addTicketMessage({
      ticketId: req.params.id,
      senderRole: isStaff(req.user) ? 'ADMIN' : 'USER',
      message: req.body.message,
      userId: req.user.id,
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
    const { status } = req.body;

    const updated = await ticketService.updateTicketStatus(req.params.id, status);
    res.json({
      success: true,
      message: `Ticket status updated to ${status}.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}
