import User from '../models/User.js';
import Counter from '../models/Counter.js';
import DoctorSchedule from '../models/DoctorSchedule.js';
import Appointment from '../models/Appointment.js';
import Prescription from '../models/Prescription.js';
import asyncHandler from '../utils/asyncHandler.js';

const getNextAppointmentCode = async () => {
  const counter = await Counter.findOneAndUpdate(
    { key: 'appointment' },
    {
      $setOnInsert: { prefix: 'APT' },
      $inc: { seq: 1 },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return `${counter.prefix}${String(counter.seq).padStart(3, '0')}`;
};

const getConfirmedDoctors = asyncHandler(async (req, res) => {
  const doctors = await User.find({
    role: 'Doctor',
    confirmed: true,
    isActive: true,
  }).select('_id username doctorProfile');

  res.status(200).json({
    success: true,
    count: doctors.length,
    doctors,
  });
});

const getDoctorSchedule = asyncHandler(async (req, res) => {
  const schedules = await DoctorSchedule.find({
    doctor: req.params.doctorId,
    status: 'Available',
  }).sort({ scheduleDate: 1, startTime: 1 });

  res.status(200).json({
    success: true,
    count: schedules.length,
    schedules,
  });
});

const bookAppointment = asyncHandler(async (req, res, next) => {
  const { doctorId, scheduleId, date, time, fee } = req.body;

  if (!doctorId || !scheduleId || !date || !time || fee === undefined) {
    const error = new Error('doctorId, scheduleId, date, time, and fee are required.');
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
    const error = new Error('Confirmed doctor not found.');
    error.statusCode = 404;
    return next(error);
  }

  const schedule = await DoctorSchedule.findOneAndUpdate(
    {
      _id: scheduleId,
      doctor: doctorId,
      status: 'Available',
    },
    { status: 'Booked' },
    { new: true }
  );

  if (!schedule) {
    const error = new Error('Schedule slot is not available.');
    error.statusCode = 400;
    return next(error);
  }

  try {
    const appointmentCode = await getNextAppointmentCode();

    const appointment = await Appointment.create({
      appointmentCode,
      patient: req.user._id,
      doctor: doctorId,
      schedule: schedule._id,
      appointmentDate: date,
      appointmentTime: time,
      consultationFee: fee,
      status: 'Pending',
      paymentStatus: 'Pending',
      patientSnapshot: {
        userCode: req.user.userCode,
        username: req.user.username,
      },
      doctorSnapshot: {
        userCode: doctor.userCode,
        username: doctor.username,
        specialization: doctor.doctorProfile?.specialization,
      },
    });

    schedule.appointment = appointment._id;
    await schedule.save();

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully.',
      appointment,
    });
  } catch (error) {
    schedule.status = 'Available';
    schedule.appointment = null;
    await schedule.save();
    return next(error);
  }
});

const getMyAppointments = asyncHandler(async (req, res) => {
  const appointments = await Appointment.find({ patient: req.user._id })
    .populate('doctor', 'username doctorProfile')
    .populate('schedule', 'scheduleDate startTime endTime status')
    .sort({ appointmentDate: -1, appointmentTime: -1 });

  res.status(200).json({
    success: true,
    count: appointments.length,
    appointments,
  });
});

const getMyPrescriptions = asyncHandler(async (req, res) => {
  const prescriptions = await Prescription.find({ patient: req.user._id })
    .populate('doctor', 'username userCode doctorProfile specialization consultationFee')
    .populate('appointment', 'appointmentCode appointmentDate appointmentTime status paymentStatus')
    .sort({ prescriptionDate: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    count: prescriptions.length,
    prescriptions,
  });
});

const payPharmacyFee = asyncHandler(async (req, res, next) => {
  const { paymentMethod = 'Cash' } = req.body;

  if (!['Card', 'Cash', 'Online'].includes(paymentMethod)) {
    const error = new Error('Payment method must be Card, Cash, or Online.');
    error.statusCode = 400;
    return next(error);
  }

  const prescription = await Prescription.findOne({
    _id: req.params.prescriptionId,
    patient: req.user._id,
  });

  if (!prescription) {
    const error = new Error('Prescription not found for this patient.');
    error.statusCode = 404;
    return next(error);
  }

  if (prescription.status === 'Cancelled') {
    const error = new Error('Cancelled prescriptions cannot receive pharmacy payments.');
    error.statusCode = 400;
    return next(error);
  }

  if (prescription.pharmacyPaymentStatus === 'Paid') {
    const populatedPrescription = await Prescription.findById(prescription._id)
      .populate('doctor', 'username userCode doctorProfile specialization consultationFee')
      .populate('appointment', 'appointmentCode appointmentDate appointmentTime status paymentStatus');

    res.status(200).json({
      success: true,
      message: 'Pharmacy fee is already paid.',
      prescription: populatedPrescription,
    });
    return;
  }

  prescription.pharmacyPaymentStatus = 'Paid';
  prescription.pharmacyPaymentMethod = paymentMethod;
  prescription.pharmacyPaidAt = new Date();
  await prescription.save();

  const populatedPrescription = await Prescription.findById(prescription._id)
    .populate('doctor', 'username userCode doctorProfile specialization consultationFee')
    .populate('appointment', 'appointmentCode appointmentDate appointmentTime status paymentStatus');

  res.status(200).json({
    success: true,
    message: 'Pharmacy fee paid successfully.',
    prescription: populatedPrescription,
  });
});

const cancelAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findOne({
    _id: req.params.id,
    patient: req.user._id,
  });

  if (!appointment) {
    const error = new Error('Appointment not found.');
    error.statusCode = 404;
    return next(error);
  }

  if (appointment.status !== 'Pending') {
    const error = new Error('Only pending appointments can be cancelled.');
    error.statusCode = 400;
    return next(error);
  }

  appointment.status = 'Cancelled';
  await appointment.save();

  if (appointment.schedule) {
    await DoctorSchedule.findByIdAndUpdate(appointment.schedule, {
      status: 'Available',
      appointment: null,
    });
  }

  res.status(200).json({
    success: true,
    message: 'Appointment cancelled successfully.',
    appointment,
  });
});

export {
  getConfirmedDoctors,
  getDoctorSchedule,
  bookAppointment,
  getMyAppointments,
  getMyPrescriptions,
  payPharmacyFee,
  cancelAppointment,
};
