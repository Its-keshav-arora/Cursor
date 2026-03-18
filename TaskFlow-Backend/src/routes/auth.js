const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { httpError } = require('../utils/errors');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw httpError(400, 'Name, email, and password are required', { code: 'validation.required' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw httpError(409, 'A user with this email already exists', { code: 'conflict.email' });
  }

  const passwordHash = await User.hashPassword(password);

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
  });

  if (!JWT_SECRET) {
    throw httpError(500, 'Server misconfiguration: missing JWT_SECRET', {
      code: 'config.missing_jwt_secret',
      expose: false,
    });
  }

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return res.status(201).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw httpError(400, 'Email and password are required', { code: 'validation.required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    throw httpError(401, 'Invalid email or password', { code: 'auth.invalid_credentials' });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw httpError(401, 'Invalid email or password', { code: 'auth.invalid_credentials' });
  }

  if (!JWT_SECRET) {
    throw httpError(500, 'Server misconfiguration: missing JWT_SECRET', {
      code: 'config.missing_jwt_secret',
      expose: false,
    });
  }

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    throw httpError(401, 'Missing Authorization header', { code: 'auth.missing_token' });
  }

  if (!JWT_SECRET) {
    throw httpError(500, 'Server misconfiguration: missing JWT_SECRET', {
      code: 'config.missing_jwt_secret',
      expose: false,
    });
  }

  const payload = jwt.verify(token, JWT_SECRET);

  const user = await User.findById(payload.sub);
  if (!user) {
    throw httpError(404, 'User not found', { code: 'not_found.user' });
  }

  return res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
});

module.exports = router;

