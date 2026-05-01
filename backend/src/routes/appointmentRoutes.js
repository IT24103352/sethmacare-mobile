import express from 'express';
import { deleteAppointment } from '../controllers/appointmentController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.delete('/:id', protect, authorizeRoles('Patient', 'Admin'), deleteAppointment);

export default router;
