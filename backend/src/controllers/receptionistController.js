import Appointment from '../models/Appointment.js';
import DoctorSchedule from '../models/DoctorSchedule.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const getDateRange = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const timeToMinutes = (value) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

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

const getAllSchedules = asyncHandler(async (req, res) => {
  const schedules = await DoctorSchedule.find()
    .populate('doctor', 'username userCode specialization consultationFee doctorProfile')
    .sort({ scheduleDate: 1, startTime: 1 });

  res.status(200).json({
    success: true,
    count: schedules.length,
    schedules,
  });
});

const createSchedule = asyncHandler(async (req, res, next) => {
  const { doctorId, scheduleDate, startTime, endTime } = req.body;

  if (!doctorId || !scheduleDate || !startTime || !endTime) {
    const error = new Error('doctorId, scheduleDate, startTime, and endTime are required.');
    error.statusCode = 400;
    return next(error);
  }

  if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
    const error = new Error('startTime and endTime must use HH:MM format.');
    error.statusCode = 400;
    return next(error);
  }

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    const error = new Error('endTime must be later than startTime.');
    error.statusCode = 400;
    return next(error);
  }

  const dateRange = getDateRange(scheduleDate);

  if (!dateRange) {
    const error = new Error('scheduleDate must be a valid date.');
    error.statusCode = 400;
    return next(error);
  }

  const doctor = await User.findOne({
    _id: doctorId,
    role: 'Doctor',
    confirmed: true,
    isActive: true,
  });

  if (!doctor) {
    const error = new Error('Active confirmed doctor not found.');
    error.statusCode = 404;
    return next(error);
  }

  const existingSchedules = await DoctorSchedule.find({
    doctor: doctor._id,
    scheduleDate: {
      $gte: dateRange.start,
      $lt: dateRange.end,
    },
    status: { $ne: 'Cancelled' },
  });
  const requestedStart = timeToMinutes(startTime);
  const requestedEnd = timeToMinutes(endTime);
  const overlappingSchedule = existingSchedules.find((schedule) => {
    const existingStart = timeToMinutes(schedule.startTime);
    const existingEnd = schedule.endTime ? timeToMinutes(schedule.endTime) : existingStart + 1;
    return requestedStart < existingEnd && requestedEnd > existingStart;
  });

  if (overlappingSchedule) {
    const error = new Error('Schedule overlaps an existing slot for this doctor.');
    error.statusCode = 409;
    return next(error);
  }

  const schedule = await DoctorSchedule.create({
    doctor: doctor._id,
    scheduleDate: dateRange.start,
    startTime,
    endTime,
    status: 'Available',
  });

  const populatedSchedule = await schedule.populate(
    'doctor',
    'username userCode specialization consultationFee doctorProfile'
  );

  res.status(201).json({
    success: true,
    message: 'Schedule slot created successfully.',
    schedule: populatedSchedule,
  });
});

const deleteSchedule = asyncHandler(async (req, res, next) => {
  const schedule = await DoctorSchedule.findById(req.params.id);

  if (!schedule) {
    const error = new Error('Schedule slot not found.');
    error.statusCode = 404;
    return next(error);
  }

  const bookedAppointmentCount = await Appointment.countDocuments({
    schedule: schedule._id,
    status: { $nin: ['Cancelled', 'Rejected'] },
  });

  if (schedule.status === 'Booked' || schedule.appointment || bookedAppointmentCount > 0) {
    const error = new Error('Booked schedule slots cannot be deleted.');
    error.statusCode = 400;
    return next(error);
  }

  await schedule.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Schedule slot deleted successfully.',
  });
});

export {
  getAllAppointments,
  getDashboardStats,
  updateAppointmentStatus,
  confirmPaidAppointment,
  getAllSchedules,
  createSchedule,
  deleteSchedule,
};
