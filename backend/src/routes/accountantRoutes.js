import express from 'express';
import {
  getDashboardStats,
  getSalaries,
  generateSalaries,
  markSalaryPaid,
  getPaymentVerificationAppointments,
  verifyAppointmentPayment,
} from '../controllers/accountantController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorizeRoles('Accountant', 'Admin'));

router.get('/dashboard-stats', getDashboardStats);
router.get('/stats', getDashboardStats);
router.get('/salaries', getSalaries);
router.post('/salaries/generate', generateSalaries);
router.patch('/salaries/:id/pay', markSalaryPaid);
router.get('/appointments', getPaymentVerificationAppointments);
router.patch('/verify-payment/:id', verifyAppointmentPayment);

export default router;
