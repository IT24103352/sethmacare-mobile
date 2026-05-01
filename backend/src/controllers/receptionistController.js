import Appointment from '../models/Appointment.js';
import asyncHandler from '../utils/asyncHandler.js';

const getAllAppointments = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const appointments = await Appointment.find(filter)
    .populate('patient', 'username userCode email phoneNumber')
    .populate('doctor', 'username userCode doctorProfile')
    .populate('schedule', 'scheduleDate startTime endTime status')
    .sort({ appointmentDate: -1, appointmentTime: -1 });

  res.status(200).json({
    success: true,
    count: appointments.length,
    appointments,
  });
});

const getDashboardStats = asyncHandler(async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const [pendingConfirmations, todaysAppointments, totalConfirmed] = await Promise.all([
    Appointment.countDocuments({ status: 'Paid' }),
    Appointment.countDocuments({
      appointmentDate: {
        $gte: todayStart,
        $lt: tomorrowStart,
      },
    }),
    Appointment.countDocuments({ status: 'Confirmed' }),
  ]);

  res.status(200).json({
    success: true,
    stats: {
      pendingConfirmations,
      todaysAppointments,
      totalConfirmed,
    },
  });
});

const updateAppointmentStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const allowedStatuses = ['Confirmed', 'Rejected'];

  if (!allowedStatuses.includes(status)) {
    const error = new Error('Status must be either Confirmed or Rejected.');
    error.statusCode = 400;
    return next(error);
  }

  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    const error = new Error('Appointment not found.');
    error.statusCode = 404;
    return next(error);
  }

  if (appointment.status !== 'Pending') {
    const error = new Error('Only pending appointments can be confirmed or rejected.');
    error.statusCode = 400;
    return next(error);
  }

  appointment.status = status;

  if (status === 'Confirmed') {
    appointment.confirmedBy = req.user._id;
    appointment.confirmedAt = new Date();
  }

  if (status === 'Rejected') {
    appointment.rejectedBy = req.user._id;
    appointment.rejectedAt = new Date();
  }

  await appointment.save();

  const populatedAppointment = await appointment.populate([
    { path: 'patient', select: 'username userCode email phoneNumber' },
    { path: 'doctor', select: 'username userCode doctorProfile' },
    { path: 'schedule', select: 'scheduleDate startTime endTime status' },
  ]);

  res.status(200).json({
    success: true,
    message: `Appointment ${status.toLowerCase()} successfully.`,
    appointment: populatedAppointment,
  });
});

const confirmPaidAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    const error = new Error('Appointment not found.');
    error.statusCode = 404;
    return next(error);
  }

  if (appointment.status !== 'Paid') {
    const error = new Error('Only paid appointments can be confirmed.');
    error.statusCode = 400;
    return next(error);
  }

  appointment.status = 'Confirmed';
  appointment.confirmedBy = req.user._id;
  appointment.confirmedAt = new Date();
  await appointment.save();

  const populatedAppointment = await appointment.populate([
    { path: 'patient', select: 'username userCode email phoneNumber' },
    { path: 'doctor', select: 'username userCode doctorProfile' },
    { path: 'schedule', select: 'scheduleDate startTime endTime status' },
  ]);

  res.status(200).json({
    success: true,
    message: 'Appointment confirmed successfully.',
    appointment: populatedAppointment,
  });
});

export { getAllAppointments, getDashboardStats, updateAppointmentStatus, confirmPaidAppointment };
