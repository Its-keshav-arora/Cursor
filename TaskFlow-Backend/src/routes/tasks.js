const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const requireAuth = require('../middleware/requireAuth');
const notificationService = require('../services/notificationService');
const { httpError } = require('../utils/errors');

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

async function ensureProjectOwned(req, res, next) {
  const project = await Project.findOne({ _id: req.params.projectId, owner: req.userId });
  if (!project) {
    return next(httpError(404, 'Project not found', { code: 'not_found.project' }));
  }
  req.project = project;
  next();
}

router.use(ensureProjectOwned);

function validatePriority(priority) {
  if (priority === undefined || priority === null) {
    return { ok: true, value: undefined };
  }

  if (typeof priority !== 'string') {
    return { ok: false, message: 'Priority must be a string.' };
  }

  const trimmed = priority.trim();
  if (!trimmed) {
    return { ok: true, value: undefined };
  }

  if (!Task.PRIORITIES.includes(trimmed)) {
    return {
      ok: false,
      message: `Invalid priority: ${trimmed}. Allowed priorities are: ${Task.PRIORITIES.join(
        ', '
      )}.`,
    };
  }

  return { ok: true, value: trimmed };
}

router.get('/', async (req, res) => {
  const tasks = await Task.find({ project: req.params.projectId }).sort({ createdAt: 1 });
  res.json({ tasks });
});

router.post('/', async (req, res) => {
  const { title, priority } = req.body;

  if (!title || !title.trim()) {
    throw httpError(400, 'Title is required', { code: 'validation.required' });
  }

  const priorityResult = validatePriority(priority);
  if (!priorityResult.ok) {
    throw httpError(400, priorityResult.message, { code: 'validation.invalid_priority' });
  }

  const task = await Task.create({
    project: req.params.projectId,
    title: title.trim(),
    ...(priorityResult.value !== undefined ? { priority: priorityResult.value } : {}),
  });

  await notificationService.taskCreated(req.userId, req.userEmail, task, req.project?.name);

  res.status(201).json({ task });
});

router.put('/:taskId', async (req, res) => {
  const { title, priority } = req.body;

  if (!title || !title.trim()) {
    throw httpError(400, 'Title is required', { code: 'validation.required' });
  }

  const priorityResult = validatePriority(priority);
  if (!priorityResult.ok) {
    throw httpError(400, priorityResult.message, { code: 'validation.invalid_priority' });
  }

  const update = {
    title: title.trim(),
  };

  if (priorityResult.value !== undefined) {
    update.priority = priorityResult.value;
  }

  const task = await Task.findOneAndUpdate(
    { _id: req.params.taskId, project: req.params.projectId },
    update,
    { new: true }
  );

  if (!task) {
    throw httpError(404, 'Task not found', { code: 'not_found.task' });
  }

  await notificationService.taskUpdated(req.userId, req.userEmail, task, req.project?.name);

  res.json({ task });
});

router.delete('/:taskId', async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.taskId,
    project: req.params.projectId,
  });

  if (!task) {
    throw httpError(404, 'Task not found', { code: 'not_found.task' });
  }

  const title = task.title;
  await Task.deleteOne({
    _id: req.params.taskId,
    project: req.params.projectId,
  });

  await notificationService.taskDeleted(req.userId, req.userEmail, title, req.project?.name);

  res.status(204).end();
});

module.exports = router;
