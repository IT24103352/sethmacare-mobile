import mongoose from 'mongoose';

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is missing. Add it to your backend .env file.');
  }

  try {
    mongoose.set('strictQuery', true);

    const connection = await mongoose.connect(mongoUri, {
      autoIndex: process.env.NODE_ENV !== 'production',
    });

    console.log(`MongoDB connected: ${connection.connection.host}/${connection.connection.name}`);
    return connection;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
};

export default connectDB;
