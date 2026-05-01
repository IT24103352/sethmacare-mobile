import express from 'express';
import {
  createPayment,
  getAllPayments,
  getPatientPayments,
  getPaymentById,
  confirmPayment,
  removePayment,
} from '../controllers/paymentController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, authorizeRoles('Patient', 'Admin'), createPayment);
router.get('/patient/:userID', protect, authorizeRoles('Patient', 'Admin'), getPatientPayments);

router.use(protect, authorizeRoles('Accountant', 'Admin'));

router.get('/', getAllPayments);
router.get('/:id', getPaymentById);
router.patch('/:id/confirm', confirmPayment);
router.delete('/:id', removePayment);

export default router;
