import mongoose from 'mongoose';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import connectDB from '../config/db.js';
import Counter from '../models/Counter.js';
import Medicine from '../models/Medicine.js';
import User from '../models/User.js';

const password = 'password123';

const getNextCode = async (key, prefix) => {
  const counter = await Counter.findOneAndUpdate(
    { key },
    {
      $setOnInsert: { prefix },
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

const seedDatabase = async () => {
  try {
    await connectDB();

    await Promise.all([
      User.deleteMany({}),
      Medicine.deleteMany({}),
      Counter.deleteMany({}),
    ]);

    await Counter.insertMany([
      { key: 'user', prefix: 'U', seq: 0 },
      { key: 'medicine', prefix: 'MED', seq: 0 },
    ]);

    const passwordHash = await bcrypt.hash(password, 10);

    const users = [
      {
        username: 'admin',
        email: 'admin@test.com',
        role: 'Admin',
      },
      {
        username: 'patient',
        email: 'patient@test.com',
        role: 'Patient',
      },
      {
        username: 'doctor',
        email: 'doctor@test.com',
        role: 'Doctor',
        doctorProfile: {
          specialization: 'Cardiology',
          consultationFee: 1500,
        },
      },
      {
        username: 'receptionist',
        email: 'receptionist@test.com',
        role: 'Receptionist',
      },
      {
        username: 'accountant',
        email: 'accountant@test.com',
        role: 'Accountant',
      },
      {
        username: 'pharmacist',
        email: 'pharmacist@test.com',
        role: 'Pharmacist',
      },
    ];

    const seededUsers = [];

    for (const user of users) {
      const userCode = await getNextCode('user', 'U');

      seededUsers.push({
        ...user,
        userCode,
        passwordHash,
        confirmed: true,
        isActive: true,
      });
    }

    await User.insertMany(seededUsers);

    const medicines = [
      {
        medicineCode: await getNextCode('medicine', 'MED'),
        name: 'Paracetamol',
        stock: 100,
        reorderLevel: 50,
        price: 50,
      },
      {
        medicineCode: await getNextCode('medicine', 'MED'),
        name: 'Amoxicillin',
        stock: 10,
        reorderLevel: 20,
        price: 120,
      },
    ];

    await Medicine.insertMany(medicines);

    console.log('SethmaCare seed data created successfully.');
    console.log('Demo password for all users:', password);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed SethmaCare database:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedDatabase();
