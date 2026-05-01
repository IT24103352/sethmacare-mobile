import mongoose from 'mongoose';

// Prescription attachments store upload metadata, not the image/file bytes.
const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    publicId: {
      type: String,
      trim: true,
    },
    originalName: {
      type: String,
      trim: true,
    },
    mimeType: {
      type: String,
      enum: ['image/jpeg', 'image/png', 'image/webp'],
    },
    size: {
      type: Number,
      min: 1,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Replaces the old prescription_medicine junction table with embedded items.
const prescriptionMedicineSchema = new mongoose.Schema(
  {
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    medicineCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    medicineName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    dosage: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    duration: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    unitPrice: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^PRE\d{3,}$/,
      index: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true,
      index: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    prescriptionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    diagnosis: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    medicines: {
      type: [prescriptionMedicineSchema],
      required: true,
      validate: {
        validator(items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: 'At least one medicine is required.',
      },
    },
    attachments: [imageSchema],
    pharmacyFeeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    pharmacyPaymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Waived', 'Refunded'],
      default: 'Pending',
      index: true,
    },
    pharmacyPaymentMethod: {
      type: String,
      enum: ['Card', 'Cash', 'Online'],
    },
    pharmacyPaidAt: {
      type: Date,
    },
    pharmacyVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['Pending', 'Dispensed', 'Cancelled'],
      default: 'Pending',
      index: true,
    },
    dispensedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    dispensedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

prescriptionSchema.index({ patient: 1, createdAt: -1 });
prescriptionSchema.index({ doctor: 1, createdAt: -1 });
prescriptionSchema.index({ status: 1, createdAt: -1 });
prescriptionSchema.index({ pharmacyPaymentStatus: 1, pharmacyPaidAt: -1 });

export default mongoose.model('Prescription', prescriptionSchema);
