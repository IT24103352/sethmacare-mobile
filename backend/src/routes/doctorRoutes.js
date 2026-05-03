import express from 'express';
import {
  getDoctorStats,
  getMyAppointments,
  getPrescriptionAppointments,
  getMyPrescriptions,
  completeAppointment,
  getMySchedule,
  getAvailableMedicines,
  createPrescription,
  uploadProfileImage,
} from '../controllers/doctorController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect, authorizeRoles('Doctor'));

router.get('/stats', getDoctorStats);
router.get('/dashboard-stats', getDoctorStats);
router.get('/appointments', getMyAppointments);
router.get('/prescription-appointments', getPrescriptionAppointments);
router.patch('/appointments/:id/complete', completeAppointment);
router.get('/medicines', getAvailableMedicines);
router.get('/schedules', getMySchedule);
router.get('/schedule', getMySchedule);
router.get('/prescriptions', getMyPrescriptions);
router.post('/prescriptions', createPrescription);
router.post('/profile-image', upload.single('image'), uploadProfileImage);

export default router;
