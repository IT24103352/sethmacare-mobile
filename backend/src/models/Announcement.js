import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    targetAudience: {
      type: String,
      enum: ['All', 'Patients', 'Doctors', 'Staff'],
      default: 'All',
    },
    status: {
      type: String,
      enum: ['Active', 'Expired'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Announcement', announcementSchema);
