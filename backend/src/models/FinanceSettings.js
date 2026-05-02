import mongoose from 'mongoose';

const financeSettingsSchema = new mongoose.Schema(
  {
    organizationCutPercentage: {
      type: Number,
      default: 30,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

export default mongoose.model('FinanceSettings', financeSettingsSchema);
