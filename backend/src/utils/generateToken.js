import jwt from 'jsonwebtoken';

const generateToken = (res, userId, role, userCode) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing. Add it to your backend .env file.');
  }

  // The JWT payload carries only identity/authorization data needed by protected APIs.
  return jwt.sign(
    {
      id: userId,
      role,
      userCode,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    }
  );
};

export default generateToken;
