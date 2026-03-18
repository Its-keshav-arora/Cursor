const express = require('express');
const Notification = require('../models/Notification');
const requireAuth = require('../middleware/requireAuth');
const { httpError } = require('../utils/errors');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const parsed = Number(req.query.limit);
  if (Number.isNaN(parsed) && req.query.limit !== undefined) {
    throw httpError(400, 'limit must be a number', { code: 'validation.invalid_limit' });
  }
  const limit = Math.min(parsed || 50, 100);
  const notifications = await Notification.find({ user: req.userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  res.json({ notifications });
});

router.delete('/', async (req, res) => {
  await Notification.deleteMany({ user: req.userId });
  res.status(204).end();
});

module.exports = router;
