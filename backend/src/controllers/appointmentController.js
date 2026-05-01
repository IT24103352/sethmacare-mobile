import Appointment from '../models/Appointment.js';
import DoctorSchedule from '../models/DoctorSchedule.js';
import Payment from '../models/Payment.js';
import asyncHandler from '../utils/asyncHandler.js';

const buildAppointmentLookup = (appointmentRef) =>
  String(appointmentRef).match(/^[0-9a-fA-F]{24}$/)
    ? { _id: appointmentRef }
    : { appointmentCode: String(appointmentRef).trim().toUpperCase() };

const deleteAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findOne(buildAppointmentLookup(req.params.id));

  if (!appointment) {
    const error = new Error('Appointment not found.');
    error.statusCode = 404;
    return next(error);
  }

  if (req.user.role === 'Patient' && String(appointment.patient) !== String(req.user._id)) {
    const error = new Error('Forbidden. You can only cancel your own appointments.');
    error.statusCode = 403;
    return next(error);
  }

  if (req.user.role === 'Patient' && appointment.status === 'Confirmed') {
    const error = new Error('Confirmed appointments cannot be cancelled by the patient.');
    error.statusCode = 400;
    return next(error);
  }

  await Payment.deleteMany({ appointment: appointment._id });

  if (appointment.schedule) {
    await DoctorSchedule.findByIdAndUpdate(appointment.schedule, {
      status: 'Available',
      appointment: null,
    });
  }

  await appointment.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Appointment cancelled successfully.',
  });
});

export { deleteAppointment };
