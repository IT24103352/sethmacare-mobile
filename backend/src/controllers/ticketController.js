import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';
import asyncHandler from '../utils/asyncHandler.js';

const adminResponseStatuses = ['In Progress', 'Resolved'];
const userPopulateFields = 'username email role userCode';

const getStringValue = (value) => (typeof value === 'string' ? value.trim() : '');

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateTicketId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError('Invalid ticket id.', 400);
  }
};

const findOwnedTicket = async (ticketId, userId) => {
  validateTicketId(ticketId);
  return Ticket.findOne({ _id: ticketId, createdBy: userId });
};

const createTicket = asyncHandler(async (req, res, next) => {
  const title = getStringValue(req.body.title);
  const description = getStringValue(req.body.description);

  if (!title || !description) {
    return next(createError('Ticket title and description are required.'));
  }

  const ticket = await Ticket.create({
    title,
    description,
    createdBy: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: 'Ticket created successfully.',
    ticket,
  });
});

const getMyTickets = asyncHandler(async (req, res) => {
  const tickets = await Ticket.find({ createdBy: req.user._id })
    .populate('respondedBy', userPopulateFields)
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: tickets.length,
    tickets,
  });
});

const updateMyTicket = asyncHandler(async (req, res, next) => {
  const ticket = await findOwnedTicket(req.params.id, req.user._id);

  if (!ticket) {
    return next(createError('Ticket not found.', 404));
  }

  if (ticket.status !== 'Open') {
    return next(createError('Tickets can only be edited while their status is Open.', 403));
  }

  if (req.body.title !== undefined) {
    const title = getStringValue(req.body.title);

    if (!title) {
      return next(createError('Ticket title cannot be empty.'));
    }

    ticket.title = title;
  }

  if (req.body.description !== undefined) {
    const description = getStringValue(req.body.description);

    if (!description) {
      return next(createError('Ticket description cannot be empty.'));
    }

    ticket.description = description;
  }

  await ticket.save();

  res.status(200).json({
    success: true,
    message: 'Ticket updated successfully.',
    ticket,
  });
});

const deleteMyTicket = asyncHandler(async (req, res, next) => {
  const ticket = await findOwnedTicket(req.params.id, req.user._id);

  if (!ticket) {
    return next(createError('Ticket not found.', 404));
  }

  if (ticket.status !== 'Open') {
    return next(createError('Tickets can only be deleted while their status is Open.', 403));
  }

  await ticket.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Ticket deleted successfully.',
  });
});

const getAllTickets = asyncHandler(async (req, res) => {
  const tickets = await Ticket.find()
    .populate('createdBy', userPopulateFields)
    .populate('respondedBy', userPopulateFields)
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: tickets.length,
    tickets,
  });
});

const respondToTicket = asyncHandler(async (req, res, next) => {
  validateTicketId(req.params.id);

  const response = getStringValue(req.body.response);
  const status = getStringValue(req.body.status);

  if (!response) {
    return next(createError('Ticket response is required.'));
  }

  if (!adminResponseStatuses.includes(status)) {
    return next(createError('Status must be In Progress or Resolved.'));
  }

  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) {
    return next(createError('Ticket not found.', 404));
  }

  ticket.response = response;
  ticket.status = status;
  ticket.respondedBy = req.user._id;

  await ticket.save();
  await ticket.populate('createdBy', userPopulateFields);
  await ticket.populate('respondedBy', userPopulateFields);

  res.status(200).json({
    success: true,
    message: 'Ticket response saved successfully.',
    ticket,
  });
});

const deleteAnyTicket = asyncHandler(async (req, res, next) => {
  validateTicketId(req.params.id);

  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) {
    return next(createError('Ticket not found.', 404));
  }

  await ticket.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Ticket deleted successfully.',
  });
});

export {
  createTicket,
  getMyTickets,
  updateMyTicket,
  deleteMyTicket,
  getAllTickets,
  respondToTicket,
  deleteAnyTicket,
};
