import Appointment from '../models/Appointment.js';
import FinanceSettings from '../models/FinanceSettings.js';
import Payment from '../models/Payment.js';
import Prescription from '../models/Prescription.js';
import Salary from '../models/Salary.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

const salaryMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const yearPattern = /^\d{4}$/;
const defaultOrganizationCutPercentage = 30;
const financeSettingsId = '000000000000000000000001';

const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;

const normalizePercentage = (value) => Math.round((Number(value) || 0) * 100) / 100;

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

const getFinanceSettings = async () =>
  FinanceSettings.findByIdAndUpdate(
    financeSettingsId,
    {
      $setOnInsert: {
        organizationCutPercentage: defaultOrganizationCutPercentage,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

const getReportRange = (query) => {
  if (query.month) {
    const requestedMonth = String(query.month).trim();

    if (salaryMonthPattern.test(requestedMonth)) {
      return {
        ...getMonthRange(requestedMonth),
        salaryMatch: { month: requestedMonth },
        label: requestedMonth,
      };
    }

    if (query.year && /^(0?[1-9]|1[0-2])$/.test(requestedMonth)) {
      const requestedYear = String(query.year).trim();

      if (!yearPattern.test(requestedYear)) {
        const error = new Error('Year must use YYYY format.');
        error.statusCode = 400;
        throw error;
      }

      const normalizedMonth = requestedMonth.padStart(2, '0');
      const salaryMonth = `${requestedYear}-${normalizedMonth}`;

      return {
        ...getMonthRange(salaryMonth),
        salaryMatch: { month: salaryMonth },
        label: salaryMonth,
      };
    }

    const error = new Error('Month must use YYYY-MM format, or use month 1-12 with year YYYY.');
    error.statusCode = 400;
    throw error;
  }

  if (query.year) {
    const requestedYear = String(query.year).trim();

    if (!yearPattern.test(requestedYear)) {
      const error = new Error('Year must use YYYY format.');
      error.statusCode = 400;
      throw error;
    }

    const start = new Date(Date.UTC(Number(requestedYear), 0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(Number(requestedYear) + 1, 0, 1, 0, 0, 0, 0));

    return {
      start,
      end,
      salaryMatch: { month: new RegExp(`^${requestedYear}-`) },
      label: requestedYear,
    };
  }

  return {
    start: null,
    end: null,
    salaryMatch: {},
    label: 'all-time',
  };
};

const buildDateMatch = (field, range) => {
  if (!range.start || !range.end) {
    return {};
  }

  return {
    [field]: {
      $gte: range.start,
      $lt: range.end,
    },
  };
};

const getAggregateSummary = (result) => ({
  total: roundCurrency(result[0]?.total || 0),
  count: result[0]?.count || 0,
});

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

  const [confirmedPayments, paidPharmacyPrescriptions, activeStaff, financeSettings] = await Promise.all([
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
    getFinanceSettings(),
  ]);

  const organizationCutPercentage = normalizePercentage(
    financeSettings?.organizationCutPercentage ?? defaultOrganizationCutPercentage
  );
  const doctorCutPercentage = normalizePercentage(100 - organizationCutPercentage);
  const organizationCutMultiplier = organizationCutPercentage / 100;
  const doctorCutMultiplier = doctorCutPercentage / 100;

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
  const organizationPool = roundCurrency(
    consultationIncome * organizationCutMultiplier + pharmacyIncome
  );
  const nonDoctorStaff = activeStaff.filter((staff) => staff.role !== 'Doctor');
  const staffPoolShare = roundCurrency(
    nonDoctorStaff.length > 0 ? organizationPool / nonDoctorStaff.length : 0
  );

  await Promise.all(
    activeStaff.map(async (staff) => {
      const doctorConsultationIncome = roundCurrency(doctorIncomeById.get(staff._id.toString()) || 0);
      const doctorConsultationShare =
        staff.role === 'Doctor' ? roundCurrency(doctorConsultationIncome * doctorCutMultiplier) : 0;
      const organizationShareSource =
        staff.role === 'Doctor'
          ? roundCurrency(doctorConsultationIncome * organizationCutMultiplier)
          : staffPoolShare;
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
          organizationCutPercentage,
          doctorCutPercentage,
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
      organizationCutPercentage,
      doctorCutPercentage,
      staffPoolShare,
      staffCount: activeStaff.length,
      nonDoctorStaffCount: nonDoctorStaff.length,
    },
    salaries,
  });
});

const updateFinanceSettings = asyncHandler(async (req, res, next) => {
  const organizationCutPercentage = Number(req.body.organizationCutPercentage);

  if (
    !Number.isFinite(organizationCutPercentage) ||
    organizationCutPercentage < 0 ||
    organizationCutPercentage > 100
  ) {
    const error = new Error('organizationCutPercentage must be a number between 0 and 100.');
    error.statusCode = 400;
    return next(error);
  }

  const normalizedOrganizationCutPercentage = normalizePercentage(organizationCutPercentage);

  const settings = await FinanceSettings.findByIdAndUpdate(
    financeSettingsId,
    {
      organizationCutPercentage: normalizedOrganizationCutPercentage,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  res.status(200).json({
    success: true,
    message: 'Finance settings updated successfully.',
    settings,
    summary: {
      organizationCutPercentage: settings.organizationCutPercentage,
      doctorCutPercentage: normalizePercentage(100 - settings.organizationCutPercentage),
    },
  });
});

const getFinancialReport = asyncHandler(async (req, res, next) => {
  let range;

  try {
    range = getReportRange(req.query);
  } catch (error) {
    return next(error);
  }

  const financeSettings = await getFinanceSettings();
  const organizationCutPercentage = normalizePercentage(
    financeSettings?.organizationCutPercentage ?? defaultOrganizationCutPercentage
  );
  const doctorCutPercentage = normalizePercentage(100 - organizationCutPercentage);
  const organizationCutMultiplier = organizationCutPercentage / 100;

  const [consultationResult, pharmacyResult, liabilitiesResult, payoutsResult] =
    await Promise.all([
      Payment.aggregate([
        {
          $match: {
            status: 'Confirmed',
            ...buildDateMatch('paymentDate', range),
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      Prescription.aggregate([
        {
          $match: {
            pharmacyPaymentStatus: 'Paid',
            ...buildDateMatch('pharmacyPaidAt', range),
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$pharmacyFeeAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
      Salary.aggregate([
        {
          $match: {
            status: 'Pending',
            ...range.salaryMatch,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      Salary.aggregate([
        {
          $match: {
            status: 'Paid',
            ...range.salaryMatch,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

  const consultationRevenue = getAggregateSummary(consultationResult);
  const pharmacyIncome = getAggregateSummary(pharmacyResult);
  const unpaidLiabilities = getAggregateSummary(liabilitiesResult);
  const paidPayouts = getAggregateSummary(payoutsResult);
  const organizationConsultationRevenue = roundCurrency(
    consultationRevenue.total * organizationCutMultiplier
  );
  const grossCashIn = roundCurrency(consultationRevenue.total + pharmacyIncome.total);
  const operationalRevenue = roundCurrency(organizationConsultationRevenue + pharmacyIncome.total);
  const netAfterPaidPayouts = roundCurrency(operationalRevenue - paidPayouts.total);
  const estimatedNetPosition = roundCurrency(
    operationalRevenue - paidPayouts.total - unpaidLiabilities.total
  );

  res.status(200).json({
    success: true,
    report: {
      period: range.label,
      settings: {
        organizationCutPercentage,
        doctorCutPercentage,
      },
      revenue: {
        consultationRevenue,
        organizationConsultationRevenue,
        pharmacyIncome,
        operationalRevenue,
        grossCashIn,
      },
      liabilities: {
        unpaidSalaries: unpaidLiabilities,
      },
      payouts: {
        paidSalaries: paidPayouts,
      },
      assetsEstimate: {
        grossCashIn,
        netAfterPaidPayouts,
      },
      estimatedNetPosition,
    },
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
  updateFinanceSettings,
  getFinancialReport,
  markSalaryPaid,
  getPaymentVerificationAppointments,
  verifyAppointmentPayment,
};
