const jwt = require('jsonwebtoken');
const { httpError } = require('../utils/errors');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    return next(httpError(401, 'Missing Authorization header', { code: 'auth.missing_token' }));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    req.userId = payload.sub;
    req.userEmail = payload.email;

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = requireAuth;

