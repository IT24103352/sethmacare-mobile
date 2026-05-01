import mongoose from 'mongoose';

// Counter documents provide safe, human-readable IDs such as U001 and APT001.
// MongoDB _id remains the real primary key; these codes are for display/search.
const counterSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ['user', 'appointment', 'payment', 'prescription', 'medicine'],
    },
    prefix: {
      type: String,
      required: true,
      enum: ['U', 'APT', 'PAY', 'PRE', 'MED'],
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Counter', counterSchema);
