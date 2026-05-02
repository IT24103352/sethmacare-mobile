import mongoose from 'mongoose';

const salarySchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    staffCodeSnapshot: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    roleSnapshot: {
      type: String,
      required: true,
      enum: ['Admin', 'Doctor', 'Receptionist', 'Accountant', 'Pharmacist'],
      index: true,
    },
    month: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Paid', 'Held'],
      default: 'Pending',
      index: true,
    },
    doctorConsultationShare: {
      type: Number,
      min: 0,
      default: 0,
    },
    organizationShareSource: {
      type: Number,
      min: 0,
      default: 0,
    },
    calculation: {
      consultationIncome: {
        type: Number,
        min: 0,
        default: 0,
      },
      pharmacyIncome: {
        type: Number,
        min: 0,
        default: 0,
      },
      organizationPool: {
        type: Number,
        min: 0,
        default: 0,
      },
      doctorConsultationIncome: {
        type: Number,
        min: 0,
        default: 0,
      },
      staffPoolShare: {
        type: Number,
        min: 0,
        default: 0,
      },
      organizationCutPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 30,
      },
      doctorCutPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 70,
      },
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    paidAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

salarySchema.index({ staff: 1, month: 1 }, { unique: true });
salarySchema.index({ month: 1, status: 1 });

export default mongoose.model('Salary', salarySchema);
