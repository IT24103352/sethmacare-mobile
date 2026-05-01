import express from 'express';
import {
  getConfirmedDoctors,
  getDoctorSchedule,
  bookAppointment,
  getMyAppointments,
  getMyPrescriptions,
  payPharmacyFee,
  cancelAppointment,
} from '../controllers/patientController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// All patient module endpoints require a valid JWT.
router.use(protect);

router.get('/doctors', getConfirmedDoctors);
router.get('/doctors/:doctorId/schedules', getDoctorSchedule);
router.get('/doctors/:doctorId/schedule', getDoctorSchedule);
router.get('/appointments/my', authorizeRoles('Patient'), getMyAppointments);
router.get('/appointments', authorizeRoles('Patient'), getMyAppointments);
router.get('/prescriptions/my', authorizeRoles('Patient'), getMyPrescriptions);
router.get('/prescriptions', authorizeRoles('Patient'), getMyPrescriptions);
router.patch('/pay-pharmacy-fee/:prescriptionId', authorizeRoles('Patient'), payPharmacyFee);
router.post('/book', authorizeRoles('Patient'), bookAppointment);
router.post('/appointments', authorizeRoles('Patient'), bookAppointment);
router.patch('/appointments/:id/cancel', authorizeRoles('Patient'), cancelAppointment);
router.delete('/appointments/:id/cancel', authorizeRoles('Patient'), cancelAppointment);

export default router;
