import mongoose from 'mongoose';

// Optional medicine image metadata. File bytes are stored outside MongoDB.
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

const medicineSchema = new mongoose.Schema(
  {
    medicineCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^MED\d{3,}$/,
      index: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      index: true,
    },
    reorderLevel: {
      type: Number,
      required: true,
      default: 50,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    image: imageSchema,
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

medicineSchema.index({ stock: 1, reorderLevel: 1 });

export default mongoose.model('Medicine', medicineSchema);
