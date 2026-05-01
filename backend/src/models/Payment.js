import mongoose from 'mongoose';

// Optional receipt upload metadata. Actual image files are handled by Multer/storage.
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

const paymentSchema = new mongoose.Schema(
  {
    paymentCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^PAY\d{3,}$/,
      index: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      index: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['Card', 'Cash', 'Online'],
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Rejected', 'Refunded'],
      default: 'Pending',
      index: true,
    },
    transactionRef: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    receiptImage: imageSchema,
    verifiedAt: {
      type: Date,
    },
    rejectedReason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ appointment: 1 }, { unique: true });
paymentSchema.index({ patient: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Payment', paymentSchema);
