const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { getIO } = require('../sockets/socketHandler');

// @route   GET /api/comments?task=:taskId
// @desc    Get all comments for a task
router.get('/', auth, async (req, res) => {
  try {
    const { task: taskId } = req.query;

    if (!taskId) {
      return res.status(400).json({ success: false, message: 'Task ID is required' });
    }

    const comments = await Comment.find({ task: taskId })
      .populate('user', 'name username avatar roleTitle')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      comments
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/comments
// @desc    Post a new comment on a task
router.post('/', auth, async (req, res) => {
  try {
    const { taskId, text } = req.body;

    if (!taskId || !text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Task ID and comment text are required' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const comment = await Comment.create({
      task: taskId,
      project: task.project,
      user: req.user._id,
      text: text.trim()
    });

    const populatedComment = await Comment.findById(comment._id)
      .populate('user', 'name username avatar roleTitle');

    // Real-time broadcast
    const io = getIO();
    if (io) {
      io.to(`project:${task.project}`).emit('comment:added', {
        taskId: task._id,
        comment: populatedComment
      });
    }

    // Notify assignees & task creator (if not the commenter)
    const notifiedUserIds = new Set();
    if (task.createdBy.toString() !== req.user._id.toString()) {
      notifiedUserIds.add(task.createdBy.toString());
    }
    if (Array.isArray(task.assignees)) {
      task.assignees.forEach(a => {
        if (a.toString() !== req.user._id.toString()) {
          notifiedUserIds.add(a.toString());
        }
      });
    }

    for (const uid of notifiedUserIds) {
      const notif = await Notification.create({
        recipient: uid,
        sender: req.user._id,
        project: task.project,
        task: task._id,
        type: 'comment_added',
        message: `${req.user.name} commented on "${task.title}": "${text.trim().substring(0, 50)}${text.length > 50 ? '...' : ''}"`
      });
      if (io) {
        io.to(`user:${uid}`).emit('notification:new', notif);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Comment posted successfully',
      comment: populatedComment
    });
  } catch (error) {
    console.error('Post comment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
