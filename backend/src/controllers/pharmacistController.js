import mongoose from 'mongoose';
import Counter from '../models/Counter.js';
import Medicine from '../models/Medicine.js';
import Prescription from '../models/Prescription.js';
import asyncHandler from '../utils/asyncHandler.js';

const getNextMedicineCode = async () => {
  const counter = await Counter.findOneAndUpdate(
    { key: 'medicine' },
    {
      $setOnInsert: { prefix: 'MED' },
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

const getAllMedicines = asyncHandler(async (req, res) => {
  const medicines = await Medicine.find().sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: medicines.length,
    medicines,
  });
});

const getLowStockMedicines = asyncHandler(async (req, res) => {
  const medicines = await Medicine.find({
    $expr: { $lte: ['$stock', '$reorderLevel'] },
  }).sort({ stock: 1, name: 1 });

  res.status(200).json({
    success: true,
    count: medicines.length,
    medicines,
  });
});

const addMedicine = asyncHandler(async (req, res, next) => {
  const { name, stock = 0, reorderLevel = 50, price, category, image } = req.body;

  if (!name || price === undefined) {
    const error = new Error('Medicine name and price are required.');
    error.statusCode = 400;
    return next(error);
  }

  if (stock <= 0 || reorderLevel <= 0 || price <= 0) {
    const error = new Error('Stock, reorder level, and price must be greater than 0.');
    error.statusCode = 400;
    return next(error);
  }

  const medicineCode = await getNextMedicineCode();

  const medicine = await Medicine.create({
    medicineCode,
    name,
    category,
    stock,
    reorderLevel,
    price,
    image,
  });

  res.status(201).json({
    success: true,
    message: 'Medicine added successfully.',
    medicine,
  });
});

const getDashboardStats = asyncHandler(async (req, res) => {
  const [pendingPayments, readyToDispense, totalDispensed] = await Promise.all([
    Prescription.countDocuments({
      status: 'Pending',
      pharmacyFeeAmount: { $gt: 0 },
      $or: [
        { pharmacyPaymentStatus: 'Pending' },
        { pharmacyPaymentStatus: { $exists: false } },
      ],
    }),
    Prescription.countDocuments({
      status: 'Pending',
      $or: [
        { pharmacyPaymentStatus: 'Paid' },
        { pharmacyFeeAmount: { $lte: 0 } },
        { pharmacyFeeAmount: { $exists: false } },
      ],
    }),
    Prescription.countDocuments({ status: 'Dispensed' }),
  ]);

  res.status(200).json({
    success: true,
    stats: {
      pendingPayments,
      readyToDispense,
      totalDispensed,
    },
  });
});

const updateMedicine = asyncHandler(async (req, res, next) => {
  const allowedFields = ['name', 'category', 'stock', 'reorderLevel', 'price', 'image', 'isActive'];
  const updates = {};

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  if (updates.stock !== undefined && updates.stock <= 0) {
    const error = new Error('Stock must be greater than 0.');
    error.statusCode = 400;
    return next(error);
  }

  if (updates.reorderLevel !== undefined && updates.reorderLevel <= 0) {
    const error = new Error('Reorder level must be greater than 0.');
    error.statusCode = 400;
    return next(error);
  }

  if (updates.price !== undefined && updates.price <= 0) {
    const error = new Error('Price must be greater than 0.');
    error.statusCode = 400;
    return next(error);
  }

  const medicine = await Medicine.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  if (!medicine) {
    const error = new Error('Medicine not found.');
    error.statusCode = 404;
    return next(error);
  }

  res.status(200).json({
    success: true,
    message: 'Medicine updated successfully.',
    medicine,
  });
});

const deleteMedicine = asyncHandler(async (req, res, next) => {
  const medicine = await Medicine.findById(req.params.id);

  if (!medicine) {
    const error = new Error('Medicine not found.');
    error.statusCode = 404;
    return next(error);
  }

  await medicine.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Medicine deleted successfully.',
  });
});

const getPendingPrescriptions = asyncHandler(async (req, res) => {
  const prescriptions = await Prescription.find({ status: 'Pending' })
    .populate('patient', 'username userCode email phoneNumber')
    .populate('doctor', 'username userCode doctorProfile')
    .populate('appointment', 'appointmentCode appointmentDate appointmentTime')
    .populate('pharmacyVerifiedBy', 'username userCode')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: prescriptions.length,
    prescriptions,
  });
});

const confirmPharmacyPayment = asyncHandler(async (req, res, next) => {
  const { paymentMethod = 'Cash' } = req.body;

  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    const error = new Error('Prescription not found.');
    error.statusCode = 404;
    return next(error);
  }

  if (prescription.status === 'Cancelled') {
    const error = new Error('Cancelled prescriptions cannot receive pharmacy payments.');
    error.statusCode = 400;
    return next(error);
  }

  if (!['Card', 'Cash', 'Online'].includes(paymentMethod)) {
    const error = new Error('Payment method must be Card, Cash, or Online.');
    error.statusCode = 400;
    return next(error);
  }

  prescription.pharmacyPaymentStatus = 'Paid';
  prescription.pharmacyPaymentMethod = paymentMethod;
  prescription.pharmacyPaidAt = new Date();
  prescription.pharmacyVerifiedBy = req.user._id;
  await prescription.save();

  const populatedPrescription = await Prescription.findById(prescription._id)
    .populate('patient', 'username userCode email phoneNumber')
    .populate('doctor', 'username userCode doctorProfile')
    .populate('appointment', 'appointmentCode appointmentDate appointmentTime')
    .populate('pharmacyVerifiedBy', 'username userCode');

  res.status(200).json({
    success: true,
    message: 'Pharmacy payment confirmed successfully.',
    prescription: populatedPrescription,
  });
});

const dispensePrescription = asyncHandler(async (req, res, next) => {
  const session = await mongoose.startSession();
  let savedPrescription;

  try {
    await session.withTransaction(async () => {
      const prescription = await Prescription.findById(req.params.id).session(session);

      if (!prescription) {
        const error = new Error('Prescription not found.');
        error.statusCode = 404;
        throw error;
      }

      if (prescription.status !== 'Pending') {
        const error = new Error('Only pending prescriptions can be dispensed.');
        error.statusCode = 400;
        throw error;
      }

      const amountDue = Number(prescription.pharmacyFeeAmount) || 0;
      const paymentStatus = prescription.pharmacyPaymentStatus || 'Pending';

      if (amountDue > 0 && paymentStatus !== 'Paid') {
        const error = new Error('Pharmacy payment must be confirmed before dispensing.');
        error.statusCode = 400;
        throw error;
      }

      for (const item of prescription.medicines) {
        const medicine = await Medicine.findById(item.medicine).session(session);

        if (!medicine) {
          const error = new Error(`Medicine not found: ${item.medicineName}`);
          error.statusCode = 404;
          throw error;
        }

        if (medicine.stock < item.quantity) {
          const error = new Error(`Insufficient stock for ${medicine.name}.`);
          error.statusCode = 400;
          throw error;
        }

        medicine.stock -= item.quantity;
        await medicine.save({ session });
      }

      prescription.status = 'Dispensed';
      prescription.dispensedBy = req.user._id;
      prescription.dispensedAt = Date.now();
      savedPrescription = await prescription.save({ session });
    });
  } finally {
    await session.endSession();
  }

  if (!savedPrescription) {
    const error = new Error('Failed to dispense prescription.');
    error.statusCode = 500;
    return next(error);
  }

  const populatedPrescription = await Prescription.findById(savedPrescription._id)
    .populate('patient', 'username userCode email phoneNumber')
    .populate('doctor', 'username userCode doctorProfile')
    .populate('appointment', 'appointmentCode appointmentDate appointmentTime')
    .populate('pharmacyVerifiedBy', 'username userCode')
    .populate('dispensedBy', 'username userCode');

  res.status(200).json({
    success: true,
    message: 'Prescription dispensed successfully.',
    prescription: populatedPrescription,
  });
});

export {
  getDashboardStats,
  getAllMedicines,
  getLowStockMedicines,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  getPendingPrescriptions,
  confirmPharmacyPayment,
  dispensePrescription,
};
