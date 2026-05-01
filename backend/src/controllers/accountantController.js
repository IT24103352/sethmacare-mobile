import Appointment from '../models/Appointment.js';
import Payment from '../models/Payment.js';
import Prescription from '../models/Prescription.js';
import Salary from '../models/Salary.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

const salaryMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;

const getMonthRange = (month) => {
  if (!salaryMonthPattern.test(month || '')) {
    const error = new Error('Month must use YYYY-MM format.');
    error.statusCode = 400;
    throw error;
  }

  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0, 0));

  return { start, end };
};

const buildAppointmentQuery = (status) => {
  if (!status || status === 'All') {
    return {
      status: {
        $in: ['Pending', 'Paid'],
      },
    };
  }

  return { status };
};

const getDashboardStats = asyncHandler(async (req, res) => {
  const [totalPayments, confirmedPayments, pendingPayments] = await Promise.all([
    Payment.countDocuments({}),
    Payment.countDocuments({ status: 'Confirmed' }),
    Payment.countDocuments({ status: 'Pending' }),
  ]);

  res.status(200).json({
    success: true,
    stats: {
      totalPayments,
      confirmed: confirmedPayments,
      pending: pendingPayments,
    },
  });
});

const getSalaries = asyncHandler(async (req, res, next) => {
  const filter = {};

  if (req.query.month) {
    try {
      getMonthRange(req.query.month);
    } catch (error) {
      return next(error);
    }

    filter.month = req.query.month;
  }

  if (req.query.status && req.query.status !== 'All') {
    filter.status = req.query.status;
  }

  const salaries = await Salary.find(filter)
    .populate('staff', 'username userCode role email')
    .populate('generatedBy', 'username userCode')
    .populate('paidBy', 'username userCode')
    .sort({ month: -1, roleSnapshot: 1, staffCodeSnapshot: 1 });

  res.status(200).json({
    success: true,
    count: salaries.length,
    salaries,
  });
});

const generateSalaries = asyncHandler(async (req, res, next) => {
  const { month } = req.body;
  let range;

  try {
    range = getMonthRange(month);
  } catch (error) {
    return next(error);
  }

  const [confirmedPayments, paidPharmacyPrescriptions, activeStaff] = await Promise.all([
    Payment.find({
      status: 'Confirmed',
      paymentDate: {
        $gte: range.start,
        $lt: range.end,
      },
    }).populate('appointment', 'doctor consultationFee appointmentCode'),
    Prescription.find({
      pharmacyPaymentStatus: 'Paid',
      pharmacyPaidAt: {
        $gte: range.start,
        $lt: range.end,
      },
    }).select('pharmacyFeeAmount pharmacyPaidAt prescriptionCode'),
    User.find({
      role: { $ne: 'Patient' },
      isActive: true,
    }).sort({ role: 1, userCode: 1 }),
  ]);

  const doctorIncomeById = new Map();
  const consultationIncome = confirmedPayments.reduce((total, payment) => {
    const amount = Number(payment.amount) || 0;
    const doctorId = payment.appointment?.doctor?.toString();

    if (doctorId) {
      doctorIncomeById.set(doctorId, (doctorIncomeById.get(doctorId) || 0) + amount);
    }

    return total + amount;
  }, 0);

  const pharmacyIncome = paidPharmacyPrescriptions.reduce(
    (total, prescription) => total + (Number(prescription.pharmacyFeeAmount) || 0),
    0
  );
  const organizationPool = roundCurrency(consultationIncome * 0.3 + pharmacyIncome);
  const nonDoctorStaff = activeStaff.filter((staff) => staff.role !== 'Doctor');
  const staffPoolShare = roundCurrency(
    nonDoctorStaff.length > 0 ? organizationPool / nonDoctorStaff.length : 0
  );

  await Promise.all(
    activeStaff.map(async (staff) => {
      const doctorConsultationIncome = roundCurrency(doctorIncomeById.get(staff._id.toString()) || 0);
      const doctorConsultationShare =
        staff.role === 'Doctor' ? roundCurrency(doctorConsultationIncome * 0.7) : 0;
      const organizationShareSource =
        staff.role === 'Doctor' ? roundCurrency(doctorConsultationIncome * 0.3) : staffPoolShare;
      const amount = staff.role === 'Doctor' ? doctorConsultationShare : staffPoolShare;

      const salaryPayload = {
        staff: staff._id,
        staffCodeSnapshot: staff.userCode,
        roleSnapshot: staff.role,
        month,
        amount,
        doctorConsultationShare,
        organizationShareSource,
        calculation: {
          consultationIncome: roundCurrency(consultationIncome),
          pharmacyIncome: roundCurrency(pharmacyIncome),
          organizationPool,
          doctorConsultationIncome,
          staffPoolShare,
        },
        generatedBy: req.user._id,
      };

      const existingSalary = await Salary.findOne({ staff: staff._id, month });

      if (existingSalary && existingSalary.status !== 'Pending') {
        return existingSalary;
      }

      return Salary.findOneAndUpdate(
        { staff: staff._id, month },
        {
          $set: {
            ...salaryPayload,
            status: 'Pending',
            paidBy: null,
            paidAt: null,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );
    })
  );

  const salaries = await Salary.find({ month })
    .populate('staff', 'username userCode role email')
    .populate('generatedBy', 'username userCode')
    .populate('paidBy', 'username userCode')
    .sort({ roleSnapshot: 1, staffCodeSnapshot: 1 });

  res.status(200).json({
    success: true,
    message: 'Salaries generated successfully.',
    summary: {
      month,
      consultationIncome: roundCurrency(consultationIncome),
      pharmacyIncome: roundCurrency(pharmacyIncome),
      organizationPool,
      staffPoolShare,
      staffCount: activeStaff.length,
      nonDoctorStaffCount: nonDoctorStaff.length,
    },
    salaries,
  });
});

const markSalaryPaid = asyncHandler(async (req, res, next) => {
  const salary = await Salary.findById(req.params.id);

  if (!salary) {
    const error = new Error('Salary record not found.');
    error.statusCode = 404;
    return next(error);
  }

  if (salary.status === 'Paid') {
    const populatedSalary = await Salary.findById(salary._id)
      .populate('staff', 'username userCode role email')
      .populate('generatedBy', 'username userCode')
      .populate('paidBy', 'username userCode');

    res.status(200).json({
      success: true,
      message: 'Salary is already marked as paid.',
      salary: populatedSalary,
    });
    return;
  }

  if (salary.status !== 'Pending') {
    const error = new Error('Only pending salary records can be marked as paid.');
    error.statusCode = 400;
    return next(error);
  }

  salary.status = 'Paid';
  salary.paidBy = req.user._id;
  salary.paidAt = new Date();
  await salary.save();

  const populatedSalary = await Salary.findById(salary._id)
    .populate('staff', 'username userCode role email')
    .populate('generatedBy', 'username userCode')
    .populate('paidBy', 'username userCode');

  res.status(200).json({
    success: true,
    message: 'Salary marked as paid.',
    salary: populatedSalary,
  });
});

const getPaymentVerificationAppointments = asyncHandler(async (req, res) => {
  const appointments = await Appointment.find(buildAppointmentQuery(req.query.status))
    .populate('patient', 'username userCode email phoneNumber')
    .populate('doctor', 'username userCode doctorProfile specialization consultationFee')
    .populate('schedule', 'scheduleDate startTime endTime status')
    .sort({ appointmentDate: -1, appointmentTime: -1 });

  res.status(200).json({
    success: true,
    count: appointments.length,
    appointments,
  });
});

const verifyAppointmentPayment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    const error = new Error('Appointment not found.');
    error.statusCode = 404;
    return next(error);
  }

  if (appointment.status !== 'Pending') {
    const error = new Error('Only pending appointments can be marked as paid.');
    error.statusCode = 400;
    return next(error);
  }

  appointment.status = 'Paid';
  appointment.paymentStatus = 'Confirmed';
  await appointment.save();

  await Payment.findOneAndUpdate(
    { appointment: appointment._id },
    {
      status: 'Confirmed',
      accountant: req.user._id,
      verifiedAt: new Date(),
    },
    { new: true }
  );

  const populatedAppointment = await appointment.populate([
    { path: 'patient', select: 'username userCode email phoneNumber' },
    { path: 'doctor', select: 'username userCode doctorProfile specialization consultationFee' },
    { path: 'schedule', select: 'scheduleDate startTime endTime status' },
  ]);

  res.status(200).json({
    success: true,
    message: 'Payment verified successfully.',
    appointment: populatedAppointment,
  });
});

export {
  getDashboardStats,
  getSalaries,
  generateSalaries,
  markSalaryPaid,
  getPaymentVerificationAppointments,
  verifyAppointmentPayment,
};
