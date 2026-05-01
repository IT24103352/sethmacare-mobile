import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Not authorized. Bearer token is required.');
      error.statusCode = 401;
      return next(error);
    }

    const token = authHeader.split(' ')[1];

    if (!process.env.JWT_SECRET) {
      const error = new Error('JWT_SECRET is missing. Authentication is not configured.');
      error.statusCode = 500;
      return next(error);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      const error = new Error('Not authorized. User account was not found or is inactive.');
      error.statusCode = 401;
      return next(error);
    }

    req.user = user;
    return next();
  } catch (error) {
    error.statusCode = 401;
    error.message = 'Not authorized. Token is invalid or expired.';
    return next(error);
  }
};

const authorizeRoles = (...allowedRolesInput) => {
  const allowedRoles = allowedRolesInput.flat();

  return (req, res, next) => {
    if (!req.user) {
      const error = new Error('Not authorized. User context is missing.');
      error.statusCode = 401;
      return next(error);
    }

    if (!allowedRoles.includes(req.user.role)) {
      const error = new Error('Forbidden. You do not have permission to access this resource.');
      error.statusCode = 403;
      return next(error);
    }

    return next();
  };
};

export { protect, authorizeRoles };
