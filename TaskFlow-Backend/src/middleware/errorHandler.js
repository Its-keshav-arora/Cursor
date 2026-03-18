const { createLogger } = require('../utils/logger');
const { AppError } = require('../utils/errors');

const logger = createLogger('errorHandler');

function normalizeError(err) {
  if (err instanceof AppError) return err;

  // jsonwebtoken
  if (err?.name === 'JsonWebTokenError') {
    return new AppError({ status: 401, code: 'auth.invalid_token', message: 'Invalid token' });
  }
  if (err?.name === 'TokenExpiredError') {
    return new AppError({ status: 401, code: 'auth.token_expired', message: 'Token expired' });
  }

  // mongoose
  if (err?.name === 'ValidationError') {
    const fieldErrors = Object.values(err.errors || {}).map((e) => ({
      path: e.path,
      message: e.message,
    }));
    return new AppError({
      status: 400,
      code: 'validation.error',
      message: 'Validation failed',
      details: fieldErrors,
    });
  }

  if (err?.name === 'CastError') {
    return new AppError({
      status: 400,
      code: 'validation.invalid_id',
      message: `Invalid ${err.path}`,
      details: { value: err.value },
    });
  }

  // Duplicate key (unique index)
  if (err?.code === 11000) {
    const keys = err?.keyValue ? Object.keys(err.keyValue) : [];
    return new AppError({
      status: 409,
      code: 'conflict.duplicate',
      message: keys.length ? `Duplicate value for: ${keys.join(', ')}` : 'Duplicate value',
      details: err?.keyValue,
    });
  }

  return new AppError({
    status: 500,
    code: 'internal.error',
    message: 'Internal server error',
    expose: false,
  });
}

function errorHandler(err, req, res, next) {
  const appErr = normalizeError(err);

  logger.error('Request failed', {
    method: req.method,
    path: req.originalUrl,
    status: appErr.status,
    code: appErr.code,
    message: err?.message,
    name: err?.name,
  });

  const response = {
    message: appErr.expose ? appErr.message : 'Internal server error',
    ...(appErr.code ? { code: appErr.code } : {}),
    ...(appErr.expose && appErr.details !== undefined ? { details: appErr.details } : {}),
  };

  res.status(appErr.status || 500).json(response);
}

module.exports = errorHandler;

