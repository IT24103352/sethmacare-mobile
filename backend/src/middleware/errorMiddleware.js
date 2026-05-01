const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  const response = {
    success: false,
    message: statusCode === 500 && isProduction ? 'Internal server error' : err.message,
  };

  // Stack traces help during local debugging but should not be exposed in production.
  if (!isProduction) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
