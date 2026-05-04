import express from 'express';
import {
  createTicket,
  getMyTickets,
  updateMyTicket,
  deleteMyTicket,
  getAllTickets,
  respondToTicket,
  deleteAnyTicket,
} from '../controllers/ticketController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/admin', authorizeRoles('Admin'), getAllTickets);
router.patch('/admin/:id/respond', authorizeRoles('Admin'), respondToTicket);
router.delete('/admin/:id', authorizeRoles('Admin'), deleteAnyTicket);

router.post('/', createTicket);
router.get('/my', getMyTickets);
router.patch('/my/:id', updateMyTicket);
router.delete('/my/:id', deleteMyTicket);

export default router;
