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

const getNextUserCodes = async (count) => {
  const counter = await Counter.findOneAndUpdate(
    { key: 'user' },
    {
      $setOnInsert: { prefix: 'U' },
      $inc: { seq: count },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  const firstSeq = counter.seq - count + 1;

  return Array.from(
    { length: count },
    (_, index) => `${counter.prefix}${String(firstSeq + index).padStart(3, '0')}`
  );
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

const handleBulkInsertError = (error) => {
  const writeError = error?.writeErrors?.[0]?.err || error?.writeErrors?.[0];
  return handleDuplicateKeyError(error) || handleDuplicateKeyError(writeError || {});
};

const allowedRoles = ['Admin', 'Patient', 'Doctor', 'Receptionist', 'Accountant', 'Pharmacist'];

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

const bulkCreateUsers = async (req, res, next) => {
  try {
    const { users = [] } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      const error = new Error('users must be a non-empty array.');
      error.statusCode = 400;
      return next(error);
    }

    const seenUsernames = new Set();
    const seenEmails = new Set();

    const normalizedUsers = users.map((user, index) => {
      const rowNumber = index + 1;
      const username = toOptionalString(user.username);
      const email = toOptionalString(user.email)?.toLowerCase();
      const password = toOptionalString(user.password);
      const role = toOptionalString(user.role);
      const specialization = toOptionalString(
        user.specialization || user.doctorProfile?.specialization
      );
      const consultationFee = toOptionalNumber(
        user.consultationFee ?? user.doctorProfile?.consultationFee
      );

      if (!username || !email || !password || !role) {
        const error = new Error(
          `Row ${rowNumber}: username, email, password, and role are required.`
        );
        error.statusCode = 400;
        throw error;
      }

      if (!allowedRoles.includes(role)) {
        const error = new Error(`Row ${rowNumber}: role must be one of ${allowedRoles.join(', ')}.`);
        error.statusCode = 400;
        throw error;
      }

      if (seenUsernames.has(username.toLowerCase())) {
        const error = new Error(`Row ${rowNumber}: duplicate username "${username}" in import file.`);
        error.statusCode = 400;
        throw error;
      }

      if (seenEmails.has(email)) {
        const error = new Error(`Row ${rowNumber}: duplicate email "${email}" in import file.`);
        error.statusCode = 400;
        throw error;
      }

      if (role === 'Doctor' && (!specialization || consultationFee === undefined)) {
        const error = new Error(
          `Row ${rowNumber}: Doctor users require specialization and consultationFee.`
        );
        error.statusCode = 400;
        throw error;
      }

      seenUsernames.add(username.toLowerCase());
      seenEmails.add(email);

      return {
        username,
        email,
        password,
        role,
        specialization,
        consultationFee,
      };
    });

    const userCodes = await getNextUserCodes(normalizedUsers.length);
    const docs = await Promise.all(
      normalizedUsers.map(async (user, index) => {
        const passwordHash = await bcrypt.hash(user.password, 10);
        const isDoctor = user.role === 'Doctor';

        return {
          userCode: userCodes[index],
          username: user.username,
          email: user.email,
          passwordHash,
          role: user.role,
          specialization: isDoctor ? user.specialization : undefined,
          consultationFee: isDoctor ? user.consultationFee : undefined,
          doctorProfile: isDoctor
            ? {
                specialization: user.specialization,
                consultationFee: user.consultationFee,
              }
            : undefined,
          confirmed: true,
        };
      })
    );

    const createdUsers = await User.insertMany(docs, { ordered: true });

    res.status(201).json({
      success: true,
      message: `${createdUsers.length} users imported successfully.`,
      count: createdUsers.length,
      users: createdUsers.map(buildSafeUser),
    });
  } catch (error) {
    const bulkInsertError = handleBulkInsertError(error);
    return next(bulkInsertError || error);
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
  bulkCreateUsers,
  loginUser,
  getMe,
  updateMe,
  getAllUsers,
  getPendingUsers,
  confirmUser,
  deleteUser,
};
