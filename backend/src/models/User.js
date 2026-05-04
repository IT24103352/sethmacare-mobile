import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Stores Multer/cloud-upload metadata. The binary file itself stays outside MongoDB.
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

const userSchema = new mongoose.Schema(
  {
    userCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^U\d{3,}$/,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 100,
      match: /^\S+@\S+\.\S+$/,
      index: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    nicNumber: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    role: {
      type: String,
      required: true,
      enum: ['Admin', 'Patient', 'Doctor', 'Receptionist', 'Accountant', 'Pharmacist'],
      index: true,
    },
    specialization: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    consultationFee: {
      type: Number,
      min: 0,
    },
    gender: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    dateOfBirth: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    nic: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 20,
    },
    dob: {
      type: Date,
    },
    confirmed: {
      type: Boolean,
      default: function () {
        return this.role === 'Admin';
      },
      index: true,
    },
    profileImage: imageSchema,
    doctorProfile: {
      specialization: {
        type: String,
        trim: true,
        maxlength: 100,
        required: function () {
          return this.role === 'Doctor';
        },
      },
      consultationFee: {
        type: Number,
        min: 0,
        required: function () {
          return this.role === 'Doctor';
        },
      },
      verificationImage: imageSchema,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, confirmed: 1 });

userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.passwordHash);
};

userSchema.methods.setPassword = async function (newPassword) {
  this.passwordHash = await bcrypt.hash(newPassword, 10);
};

export default mongoose.model('User', userSchema);
