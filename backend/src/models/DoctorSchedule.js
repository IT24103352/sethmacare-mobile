import mongoose from 'mongoose';

const doctorScheduleSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    scheduleDate: {
      type: Date,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    endTime: {
      type: String,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    status: {
      type: String,
      enum: ['Available', 'Booked', 'Cancelled'],
      default: 'Available',
      index: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
  },
  { timestamps: true }
);

// Prevents one doctor from creating the same date/time slot twice.
doctorScheduleSchema.index(
  { doctor: 1, scheduleDate: 1, startTime: 1 },
  { unique: true }
);
doctorScheduleSchema.index({ doctor: 1, scheduleDate: 1, status: 1 });

export default mongoose.model('DoctorSchedule', doctorScheduleSchema, 'doctorSchedules');
