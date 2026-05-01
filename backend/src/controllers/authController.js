import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import generateToken from '../utils/generateToken.js';

const buildSafeUser = (user) => {
  const safeUser = user.toObject();
  delete safeUser.passwordHash;

  if (!safeUser.nicNumber && safeUser.nic) {
    safeUser.nicNumber = safeUser.nic;
  }

  if (!safeUser.nic && safeUser.nicNumber) {
    safeUser.nic = safeUser.nicNumber;
  }

  if (!safeUser.dateOfBirth && safeUser.dob) {
    safeUser.dateOfBirth =
      safeUser.dob instanceof Date
        ? safeUser.dob.toISOString().slice(0, 10)
        : String(safeUser.dob).slice(0, 10);
  }

  if (safeUser.role === 'Doctor') {
    if (!safeUser.specialization && safeUser.doctorProfile?.specialization) {
      safeUser.specialization = safeUser.doctorProfile.specialization;
    }

    if (
      (safeUser.consultationFee === undefined || safeUser.consultationFee === null) &&
      safeUser.doctorProfile?.consultationFee !== undefined
    ) {
      safeUser.consultationFee = safeUser.doctorProfile.consultationFee;
    }
  }

  return safeUser;
};

const toOptionalString = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value).trim();
};

const toOptionalDate = (value) => {
  const normalizedValue = toOptionalString(value);

  if (!normalizedValue) {
    return undefined;
  }

  const parsedDate = new Date(normalizedValue);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

const toOptionalNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsedNumber = Number(value);
  return Number.isNaN(parsedNumber) ? undefined : parsedNumber;
};

const getNextUserCode = async () => {
  const counter = await Counter.findOneAndUpdate(
    { key: 'user' },
    {
      $setOnInsert: { prefix: 'U' },
      $inc: { seq: 1 },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return `${counter.prefix}${String(counter.seq).padStart(3, '0')}`;
};

const handleDuplicateKeyError = (error) => {
  if (error.code !== 11000) {
    return null;
  }

  const duplicateField = Object.keys(error.keyValue || {})[0] || 'field';
  const formattedField = duplicateField.replace(/([A-Z])/g, ' $1').toLowerCase();
  const duplicateError = new Error(`A user with this ${formattedField} already exists.`);
  duplicateError.statusCode = 409;
  return duplicateError;
};

const registerUser = async (req, res, next) => {
  try {
    const {
      username,
      password,
      email,
      phoneNumber,
      address,
      role,
      gender,
      nic,
      nicNumber,
      dob,
      DOB,
      dateOfBirth,
      profileImage,
      doctorProfile = {},
      specialization,
      consultationFee,
    } = req.body;

    if (!username || !password || !email || !role) {
      const error = new Error('Username, password, email, and role are required.');
      error.statusCode = 400;
      return next(error);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userCode = await getNextUserCode();
    const normalizedRole = role.trim();
    const normalizedNic = toOptionalString(nicNumber || nic);
    const normalizedDateOfBirth = toOptionalString(dateOfBirth || dob || DOB);
    const normalizedSpecialization = toOptionalString(
      doctorProfile.specialization || specialization
    );
    const normalizedConsultationFee = toOptionalNumber(
      doctorProfile.consultationFee ?? consultationFee
    );

    const user = await User.create({
      userCode,
      username,
      passwordHash,
      email,
      phoneNumber,
      address,
      role: normalizedRole,
      gender,
      specialization: normalizedSpecialization,
      consultationFee: normalizedConsultationFee,
      nicNumber: normalizedNic,
      nic: normalizedNic,
      dateOfBirth: normalizedDateOfBirth,
      dob: toOptionalDate(normalizedDateOfBirth),
      confirmed: normalizedRole === 'Admin',
      profileImage,
      doctorProfile: {
        specialization: normalizedSpecialization,
        consultationFee: normalizedConsultationFee,
        verificationImage: doctorProfile.verificationImage,
      },
    });

    res.status(201).json({
      success: true,
      message:
        normalizedRole === 'Admin'
          ? 'Admin user registered successfully.'
          : 'Registration successful. Please wait for admin confirmation.',
      user: buildSafeUser(user),
    });
  } catch (error) {
    const duplicateError = handleDuplicateKeyError(error);
    return next(duplicateError || error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { identifier, username, email, password } = req.body;
    const loginIdentifier = identifier || username || email;

    if (!loginIdentifier || !password) {
      const error = new Error('Username/email and password are required.');
      error.statusCode = 400;
      return next(error);
    }

    const user = await User.findOne({
      $or: [{ username: loginIdentifier }, { email: loginIdentifier.toLowerCase() }],
    }).select('+passwordHash');

    if (!user) {
      const error = new Error('Invalid credentials.');
      error.statusCode = 401;
      return next(error);
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      const error = new Error('Invalid credentials.');
      error.statusCode = 401;
      return next(error);
    }

    if (!user.confirmed && user.role !== 'Admin') {
      const error = new Error('Account is pending admin confirmation.');
      error.statusCode = 403;
      return next(error);
    }

    if (!user.isActive) {
      const error = new Error('Account is inactive.');
      error.statusCode = 403;
      return next(error);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(res, user._id, user.role, user.userCode);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: buildSafeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      user: buildSafeUser(req.user),
    });
  } catch (error) {
    return next(error);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const {
      phoneNumber,
      nicNumber,
      nic,
      gender,
      dateOfBirth,
      dob,
      DOB,
      address,
      specialization,
      consultationFee,
      doctorProfile = {},
    } = req.body;

    if (phoneNumber !== undefined) {
      req.user.phoneNumber = toOptionalString(phoneNumber) || '';
    }

    if (address !== undefined) {
      req.user.address = toOptionalString(address) || '';
    }

    if (gender !== undefined) {
      req.user.gender = toOptionalString(gender) || '';
    }

    if (nicNumber !== undefined || nic !== undefined) {
      const normalizedNic = toOptionalString(nicNumber ?? nic) || '';
      req.user.nicNumber = normalizedNic;
      req.user.nic = normalizedNic || undefined;
    }

    if (dateOfBirth !== undefined || dob !== undefined || DOB !== undefined) {
      const normalizedDateOfBirth = toOptionalString(dateOfBirth ?? dob ?? DOB) || '';
      req.user.dateOfBirth = normalizedDateOfBirth;
      req.user.dob = toOptionalDate(normalizedDateOfBirth);
    }

    if (req.user.role === 'Doctor') {
      const requestedSpecialization =
        doctorProfile.specialization !== undefined
          ? doctorProfile.specialization
          : specialization;
      const requestedConsultationFee =
        doctorProfile.consultationFee !== undefined
          ? doctorProfile.consultationFee
          : consultationFee;

      if (requestedSpecialization !== undefined) {
        const normalizedSpecialization = toOptionalString(requestedSpecialization) || '';
        req.user.specialization = normalizedSpecialization;
        req.user.doctorProfile = {
          ...(req.user.doctorProfile?.toObject?.() || req.user.doctorProfile || {}),
          specialization: normalizedSpecialization,
        };
      }

      if (requestedConsultationFee !== undefined) {
        const normalizedConsultationFee = toOptionalNumber(requestedConsultationFee);
        req.user.consultationFee = normalizedConsultationFee;
        req.user.doctorProfile = {
          ...(req.user.doctorProfile?.toObject?.() || req.user.doctorProfile || {}),
          consultationFee: normalizedConsultationFee,
        };
      }
    }

    await req.user.save();

    res.status(200).json({
      success: true,
      message: 'Profile details updated successfully.',
      user: buildSafeUser(req.user),
    });
  } catch (error) {
    const duplicateError = handleDuplicateKeyError(error);
    return next(duplicateError || error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    return next(error);
  }
};

const getPendingUsers = async (req, res, next) => {
  try {
    const users = await User.find({ confirmed: false }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    return next(error);
  }
};

const confirmUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      return next(error);
    }

    user.confirmed = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User confirmed successfully.',
      user: buildSafeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      return next(error);
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully.',
    });
  } catch (error) {
    return next(error);
  }
};

export {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  getAllUsers,
  getPendingUsers,
  confirmUser,
  deleteUser,
};
