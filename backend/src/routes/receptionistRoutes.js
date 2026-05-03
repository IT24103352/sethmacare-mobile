import express from 'express';
import {
  getAllAppointments,
  getDashboardStats,
  updateAppointmentStatus,
  confirmPaidAppointment,
  getAllSchedules,
  createSchedule,
  deleteSchedule,
} from '../controllers/receptionistController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorizeRoles('Receptionist', 'Admin'));

router.get('/dashboard-stats', getDashboardStats);
router.get('/stats', getDashboardStats);
router.get('/appointments', getAllAppointments);
router.get('/schedules', getAllSchedules);
router.post('/schedules', createSchedule);
router.delete('/schedules/:id', deleteSchedule);
router.patch('/confirm-appointment/:id', confirmPaidAppointment);
router.patch('/appointments/:id/confirm', (req, res, next) => {
  req.body.status = 'Confirmed';
  next();
}, updateAppointmentStatus);
router.patch('/appointments/:id/reject', (req, res, next) => {
  req.body.status = 'Rejected';
  next();
}, updateAppointmentStatus);
router.patch('/appointments/:id/status', updateAppointmentStatus);

export default router;
