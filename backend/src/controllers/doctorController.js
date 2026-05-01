import Appointment from '../models/Appointment.js';
import Counter from '../models/Counter.js';
import DoctorSchedule from '../models/DoctorSchedule.js';
import Medicine from '../models/Medicine.js';
import Prescription from '../models/Prescription.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

const getNextPrescriptionCode = async () => {
  const counter = await Counter.findOneAndUpdate(
    { key: 'prescription' },
    {
      $setOnInsert: { prefix: 'PRE' },
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

const getDoctorStats = asyncHandler(async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const [totalAppointments, confirmedToday, pendingRequests] = await Promise.all([
    Appointment.countDocuments({ doctor: req.user._id }),
    Appointment.countDocuments({
      doctor: req.user._id,
      status: 'Confirmed',
      appointmentDate: {
        $gte: todayStart,
        $lt: tomorrowStart,
      },
    }),
    Appointment.countDocuments({
      doctor: req.user._id,
      status: 'Pending',
    }),
  ]);

  res.status(200).json({
    success: true,
    stats: {
      totalAppointments,
      confirmedToday,
      pendingRequests,
    },
  });
});

const getMyAppointments = asyncHandler(async (req, res) => {
  const filter = { doctor: req.user._id };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const appointments = await Appointment.find(filter)
    .populate('patient', 'username userCode email phoneNumber')
    .populate('schedule', 'scheduleDate startTime endTime status')
    .sort({ appointmentDate: -1, appointmentTime: -1 });

  res.status(200).json({
    success: true,
    count: appointments.length,
    appointments,
  });
});

const getPrescriptionAppointments = asyncHandler(async (req, res) => {
  const appointments = await Appointment.find({
    doctor: req.user._id,
    status: { $in: ['Completed', 'Prescribed'] },
  })
    .populate('patient', 'username userCode email phoneNumber')
    .populate('schedule', 'scheduleDate startTime endTime status')
    .sort({ appointmentDate: -1, appointmentTime: -1 });

  const prescriptions = await Prescription.find({
    appointment: { $in: appointments.map((appointment) => appointment._id) },
  }).select('_id prescriptionCode appointment status createdAt prescriptionDate');

  const prescriptionByAppointment = prescriptions.reduce((lookup, prescription) => {
    lookup[prescription.appointment.toString()] = prescription;
    return lookup;
  }, {});

  res.status(200).json({
    success: true,
    count: appointments.length,
    appointments: appointments.map((appointment) => ({
      ...appointment.toObject(),
      prescription: prescriptionByAppointment[appointment._id.toString()] || null,
    })),
  });
});

const getMyPrescriptions = asyncHandler(async (req, res) => {
  const prescriptions = await Prescription.find({ doctor: req.user._id })
    .populate('patient', 'username userCode email phoneNumber')
    .populate('appointment', 'appointmentCode appointmentDate appointmentTime status paymentStatus')
    .sort({ prescriptionDate: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    count: prescriptions.length,
    prescriptions,
  });
});

const getPrescriptionMedicines = asyncHandler(async (req, res) => {
  const medicines = await Medicine.find({ isActive: true }).sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: medicines.length,
    medicines,
  });
});

const completeAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findOne({
    _id: req.params.id,
    doctor: req.user._id,
  });

  if (!appointment) {
    const error = new Error('Appointment not found for this doctor.');
    error.statusCode = 404;
    return next(error);
  }

  if (appointment.status !== 'Confirmed') {
    const error = new Error('Only confirmed appointments can be completed.');
    error.statusCode = 400;
    return next(error);
  }

  appointment.status = 'Completed';
  await appointment.save();

  const populatedAppointment = await appointment.populate([
    { path: 'patient', select: 'username userCode email phoneNumber' },
    { path: 'doctor', select: 'username userCode doctorProfile' },
    { path: 'schedule', select: 'scheduleDate startTime endTime status' },
  ]);

  res.status(200).json({
    success: true,
    message: 'Appointment marked as completed.',
    appointment: populatedAppointment,
  });
});

const getMySchedule = asyncHandler(async (req, res) => {
  const schedules = await DoctorSchedule.find({ doctor: req.user._id }).sort({
    scheduleDate: 1,
    startTime: 1,
  });

  res.status(200).json({
    success: true,
    count: schedules.length,
    schedules,
  });
});

const getAvailableMedicines = asyncHandler(async (req, res) => {
  const medicines = await Medicine.find({ isActive: true }).sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: medicines.length,
    medicines,
  });
});

const addScheduleSlot = asyncHandler(async (req, res, next) => {
  const { scheduleDate, startTime, endTime } = req.body;

  if (!scheduleDate || !startTime) {
    const error = new Error('scheduleDate and startTime are required.');
    error.statusCode = 400;
    return next(error);
  }

  const existingSlot = await DoctorSchedule.findOne({
    doctor: req.user._id,
    scheduleDate,
    startTime,
  });

  if (existingSlot) {
    const error = new Error('Schedule slot already exists for this date and time.');
    error.statusCode = 409;
    return next(error);
  }

  const schedule = await DoctorSchedule.create({
    doctor: req.user._id,
    scheduleDate,
    startTime,
    endTime,
    status: 'Available',
  });

  res.status(201).json({
    success: true,
    message: 'Schedule slot added successfully.',
    schedule,
  });
});

const deleteScheduleSlot = asyncHandler(async (req, res, next) => {
  const schedule = await DoctorSchedule.findOne({
    _id: req.params.id,
    doctor: req.user._id,
  });

  if (!schedule) {
    const error = new Error('Schedule slot not found.');
    error.statusCode = 404;
    return next(error);
  }

  if (schedule.status !== 'Available') {
    const error = new Error('Only available schedule slots can be deleted.');
    error.statusCode = 400;
    return next(error);
  }

  await schedule.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Schedule slot deleted successfully.',
  });
});

const createPrescription = asyncHandler(async (req, res, next) => {
  const { appointmentId, appointmentID, medicines, diagnosis, notes, attachments } = req.body;
  const appointmentRef = appointmentId || appointmentID;

  if (!appointmentRef || !Array.isArray(medicines) || medicines.length === 0) {
    const error = new Error('appointmentId and at least one medicine are required.');
    error.statusCode = 400;
    return next(error);
  }

  const appointmentQuery = String(appointmentRef).match(/^[0-9a-fA-F]{24}$/)
    ? { _id: appointmentRef }
    : { appointmentCode: String(appointmentRef).trim().toUpperCase() };

  const appointment = await Appointment.findOne({
    ...appointmentQuery,
    doctor: req.user._id,
  });

  if (!appointment) {
    const error = new Error('Appointment not found for this doctor.');
    error.statusCode = 404;
    return next(error);
  }

  if (!['Confirmed', 'Completed'].includes(appointment.status)) {
    const error = new Error('Prescription can only be created for confirmed or completed appointments.');
    error.statusCode = 400;
    return next(error);
  }

  const existingPrescription = await Prescription.findOne({ appointment: appointment._id });

  if (existingPrescription) {
    const error = new Error('A prescription already exists for this appointment.');
    error.statusCode = 409;
    return next(error);
  }

  const prescriptionMedicines = await Promise.all(
    medicines.map(async (item) => {
      const medicineId = item.medicine || item.medicineId || item.medicineID;
      const medicineCode = item.medicineCode?.trim()?.toUpperCase();

      if ((!medicineId && !medicineCode) || !item.quantity || Number(item.quantity) < 1) {
        const error = new Error('Each medicine requires a valid medicine id/code and quantity.');
        error.statusCode = 400;
        throw error;
      }

      const medicine = medicineId
        ? await Medicine.findById(medicineId)
        : await Medicine.findOne({ medicineCode });

      if (!medicine || !medicine.isActive) {
        const error = new Error('One or more selected medicines were not found.');
        error.statusCode = 404;
        throw error;
      }

      return {
        medicine: medicine._id,
        medicineCode: medicine.medicineCode,
        medicineName: medicine.name,
        quantity: Number(item.quantity),
        dosage: item.dosage,
        duration: item.duration,
        instructions: item.instructions,
        unitPrice: medicine.price,
      };
    })
  );
  const pharmacyFeeAmount = prescriptionMedicines.reduce(
    (total, item) => total + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  );

  const prescriptionCode = await getNextPrescriptionCode();

  const prescription = await Prescription.create({
    prescriptionCode,
    appointment: appointment._id,
    patient: appointment.patient,
    doctor: req.user._id,
    diagnosis,
    notes,
    medicines: prescriptionMedicines,
    attachments,
    pharmacyFeeAmount,
    pharmacyPaymentStatus: 'Pending',
    status: 'Pending',
  });

  appointment.status = 'Prescribed';
  await appointment.save();

  res.status(201).json({
    success: true,
    message: 'Prescription created successfully.',
    prescription,
  });
});

const uploadProfileImage = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    const error = new Error('Image file is required.');
    error.statusCode = 400;
    return next(error);
  }

  const imageUrl = `/uploads/${req.file.filename}`;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      profileImage: {
        url: imageUrl,
        publicId: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date(),
      },
    },
    { new: true }
  );

  res.status(200).json({
    success: true,
    message: 'Profile image uploaded successfully.',
    image: user.profileImage,
    user,
  });
});

export {
  getDoctorStats,
  getMyAppointments,
  getPrescriptionAppointments,
  getMyPrescriptions,
  completeAppointment,
  getMySchedule,
  getAvailableMedicines,
  addScheduleSlot,
  deleteScheduleSlot,
  createPrescription,
  uploadProfileImage,
};
