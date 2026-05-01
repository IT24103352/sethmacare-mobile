import express from 'express';
import { getMySalaries } from '../controllers/salaryController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(
  protect,
  authorizeRoles('Admin', 'Doctor', 'Receptionist', 'Accountant', 'Pharmacist')
);

router.get('/me', getMySalaries);

export default router;
