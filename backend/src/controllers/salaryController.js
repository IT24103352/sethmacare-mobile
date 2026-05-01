import Salary from '../models/Salary.js';
import asyncHandler from '../utils/asyncHandler.js';

const staffRoles = ['Admin', 'Doctor', 'Receptionist', 'Accountant', 'Pharmacist'];

const getMySalaries = asyncHandler(async (req, res, next) => {
  if (!staffRoles.includes(req.user.role)) {
    const error = new Error('Salary history is available for staff accounts only.');
    error.statusCode = 403;
    return next(error);
  }

  const salaries = await Salary.find({ staff: req.user._id })
    .populate('generatedBy', 'username userCode')
    .populate('paidBy', 'username userCode')
    .sort({ month: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    count: salaries.length,
    salaries,
  });
});

export { getMySalaries };
