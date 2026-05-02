import Appointment from '../models/Appointment.js';
import Counter from '../models/Counter.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

const getNextPaymentCode = async () => {
  const counter = await Counter.findOneAndUpdate(
    { key: 'payment' },
    {
      $setOnInsert: { prefix: 'PAY' },
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

const createPayment = asyncHandler(async (req, res, next) => {
  const {
    appointmentId,
    appointmentID,
    amount,
    paymentMethod = 'Cash',
    transactionRef,
    receiptImage,
  } = req.body;
  const appointmentRef = appointmentId || appointmentID;

  if (!appointmentRef || amount === undefined) {
    const error = new Error('appointmentId and amount are required.');
    error.statusCode = 400;
    return next(error);
  }

  const appointmentQuery = String(appointmentRef).match(/^[0-9a-fA-F]{24}$/)
    ? { _id: appointmentRef }
    : { appointmentCode: String(appointmentRef).trim().toUpperCase() };
  const appointment = await Appointment.findOne(appointmentQuery);

  if (!appointment) {
    const error = new Error('Appointment not found.');
    error.statusCode = 404;
    return next(error);
  }

  if (String(appointment.patient) !== String(req.user._id) && req.user.role !== 'Admin') {
    const error = new Error('Forbidden. Payment can only be created by the appointment patient.');
    error.statusCode = 403;
    return next(error);
  }

  const existingPayment = await Payment.findOne({ appointment: appointment._id });

  if (existingPayment) {
    res.status(200).json({
      success: true,
      message: 'Payment already exists for this appointment.',
      payment: existingPayment,
    });
    return;
  }

  const paymentCode = await getNextPaymentCode();

  const payment = await Payment.create({
    paymentCode,
    appointment: appointment._id,
    patient: appointment.patient,
    amount,
    paymentMethod,
    transactionRef,
    receiptImage,
    status: 'Pending',
  });

  const populatedPayment = await Payment.findById(payment._id)
    .populate('patient', 'username userCode email phoneNumber')
    .populate('appointment', 'appointmentCode appointmentDate appointmentTime status paymentStatus consultationFee')
    .populate('accountant', 'username userCode');

  res.status(201).json({
    success: true,
    message: 'Payment recorded as pending.',
    payment: populatedPayment,
  });
});

const getAllPayments = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const payments = await Payment.find(filter)
    .populate('patient', 'username userCode email phoneNumber')
    .populate('appointment', 'appointmentCode appointmentDate appointmentTime status paymentStatus consultationFee')
    .populate('accountant', 'username userCode')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: payments.length,
    payments,
  });
});

const getPatientPayments = asyncHandler(async (req, res, next) => {
  const { userID } = req.params;
  let patientId = req.user._id;

  if (req.user.role === 'Patient') {
    const isOwnRecord =
      userID === 'me' ||
      String(req.user._id) === String(userID) ||
      req.user.userCode === String(userID).trim().toUpperCase();

    if (!isOwnRecord) {
      const error = new Error('Forbidden. You can only view your own payments.');
      error.statusCode = 403;
      return next(error);
    }
  } else {
    const patientLookup = String(userID).match(/^[0-9a-fA-F]{24}$/)
      ? { _id: userID }
      : { userCode: String(userID).trim().toUpperCase() };
    const patient = await User.findOne(patientLookup);

    if (!patient) {
      const error = new Error('Patient not found.');
      error.statusCode = 404;
      return next(error);
    }

    patientId = patient._id;
  }

  const payments = await Payment.find({ patient: patientId })
    .populate('patient', 'username userCode email phoneNumber')
    .populate('appointment', 'appointmentCode appointmentDate appointmentTime status paymentStatus consultationFee')
    .populate('accountant', 'username userCode')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: payments.length,
    payments,
  });
});

const getPaymentById = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id)
    .populate('patient', 'username userCode email phoneNumber')
    .populate('appointment', 'appointmentCode appointmentDate appointmentTime status paymentStatus consultationFee')
    .populate('accountant', 'username userCode');

  if (!payment) {
    const error = new Error('Payment not found.');
    error.statusCode = 404;
    return next(error);
  }

  res.status(200).json({
    success: true,
    payment,
  });
});

const confirmPayment = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    const error = new Error('Payment not found.');
    error.statusCode = 404;
    return next(error);
  }

  if (payment.status !== 'Pending') {
    const error = new Error('Only pending payments can be confirmed.');
    error.statusCode = 400;
    return next(error);
  }

  payment.status = 'Confirmed';
  payment.accountant = req.user._id;
  payment.verifiedAt = Date.now();
  await payment.save();

  await Appointment.findByIdAndUpdate(payment.appointment, {
    paymentStatus: 'Confirmed',
    status: 'Paid',
  });

  const populatedPayment = await Payment.findById(payment._id)
    .populate('patient', 'username userCode email phoneNumber')
    .populate('appointment', 'appointmentCode appointmentDate appointmentTime status paymentStatus consultationFee')
    .populate('accountant', 'username userCode');

  res.status(200).json({
    success: true,
    message: 'Payment confirmed successfully.',
    payment: populatedPayment,
  });
});

const rejectPayment = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    const error = new Error('Payment not found.');
    error.statusCode = 404;
    return next(error);
  }

  if (payment.status !== 'Pending') {
    const error = new Error('Only pending payments can be rejected.');
    error.statusCode = 400;
    return next(error);
  }

  const rejectedReason =
    typeof req.body.rejectedReason === 'string' ? req.body.rejectedReason.trim() : '';

  payment.status = 'Rejected';
  payment.rejectedReason = rejectedReason;
  payment.accountant = req.user._id;
  payment.verifiedAt = new Date();
  await payment.save();

  await Appointment.findByIdAndUpdate(payment.appointment, {
    paymentStatus: 'Rejected',
  });

  const populatedPayment = await Payment.findById(payment._id)
    .populate('patient', 'username userCode email phoneNumber')
    .populate('appointment', 'appointmentCode appointmentDate appointmentTime status paymentStatus consultationFee')
    .populate('accountant', 'username userCode');

  res.status(200).json({
    success: true,
    message: 'Payment rejected successfully.',
    payment: populatedPayment,
  });
});

const removePayment = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    const error = new Error('Payment not found.');
    error.statusCode = 404;
    return next(error);
  }

  if (payment.status === 'Confirmed') {
    const error = new Error('Confirmed payments cannot be removed. Use a refund workflow to preserve financial history.');
    error.statusCode = 400;
    return next(error);
  }

  const appointment = await Appointment.findById(payment.appointment);

  if (appointment && ['Pending', 'Paid'].includes(appointment.status)) {
    appointment.paymentStatus = 'Pending';
    appointment.status = 'Pending';
    await appointment.save();
  }

  await payment.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Payment removed successfully.',
  });
});

export {
  createPayment,
  getAllPayments,
  getPatientPayments,
  getPaymentById,
  confirmPayment,
  rejectPayment,
  removePayment,
};
