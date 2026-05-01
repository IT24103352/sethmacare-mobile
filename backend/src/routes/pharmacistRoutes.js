import express from 'express';
import {
  getDashboardStats,
  getAllMedicines,
  getLowStockMedicines,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  getPendingPrescriptions,
  confirmPharmacyPayment,
  dispensePrescription,
} from '../controllers/pharmacistController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorizeRoles('Pharmacist', 'Admin'));

router.get('/dashboard-stats', getDashboardStats);
router.get('/stats', getDashboardStats);
router.get('/medicines', getAllMedicines);
router.get('/medicines/low-stock', getLowStockMedicines);
router.post('/medicines', addMedicine);
router.patch('/medicines/:id', updateMedicine);
router.delete('/medicines/:id', deleteMedicine);
router.get('/prescriptions/pending', getPendingPrescriptions);
router.patch('/confirm-pharmacy-payment/:id', confirmPharmacyPayment);
router.patch('/prescriptions/:id/confirm-pharmacy-payment', confirmPharmacyPayment);
router.patch('/prescriptions/:id/dispense', dispensePrescription);

export default router;
