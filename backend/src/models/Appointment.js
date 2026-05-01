import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    appointmentCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^APT\d{3,}$/,
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
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoctorSchedule',
    },
    appointmentDate: {
      type: Date,
      required: true,
      index: true,
    },
    appointmentTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    consultationFee: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Paid', 'Confirmed', 'Rejected', 'Cancelled', 'Completed', 'Prescribed'],
      default: 'Pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Rejected', 'Refunded'],
      default: 'Pending',
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    patientSnapshot: {
      userCode: String,
      username: String,
    },
    doctorSnapshot: {
      userCode: String,
      username: String,
      specialization: String,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    confirmedAt: {
      type: Date,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

appointmentSchema.index({ patient: 1, appointmentDate: -1 });
appointmentSchema.index({ doctor: 1, appointmentDate: -1 });
appointmentSchema.index({ status: 1, paymentStatus: 1 });

export default mongoose.model('Appointment', appointmentSchema);
