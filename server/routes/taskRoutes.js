const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Project = require('../models/Project');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { getIO } = require('../sockets/socketHandler');

// @route   GET /api/tasks?project=:projectId
// @desc    Get all tasks for a project
router.get('/', auth, async (req, res) => {
  try {
    const { project: projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Project ID is required' });
    }

    const tasks = await Task.find({ project: projectId })
      .populate('assignees', 'name username avatar roleTitle email')
      .populate('createdBy', 'name username avatar')
      .sort({ order: 1, createdAt: -1 });

    // Attach comment counts
    const tasksWithCounts = await Promise.all(
      tasks.map(async (t) => {
        const commentCount = await Comment.countDocuments({ task: t._id });
        return {
          ...t.toObject(),
          commentCount
        };
      })
    );

    res.json({
      success: true,
      tasks: tasksWithCounts
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/tasks/:id
// @desc    Get single task
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignees', 'name username avatar roleTitle email')
      .populate('createdBy', 'name username avatar')
      .populate('project', 'name color');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const commentCount = await Comment.countDocuments({ task: task._id });

    res.json({
      success: true,
      task: {
        ...task.toObject(),
        commentCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/tasks
// @desc    Create a new task
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, project: projectId, columnId, priority, dueDate, assignees, labels, checklist } = req.body;

    if (!title || !projectId) {
      return res.status(400).json({ success: false, message: 'Title and project are required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Determine order (append to bottom of column)
    const targetCol = columnId || 'todo';
    const lastTask = await Task.findOne({ project: projectId, columnId: targetCol }).sort({ order: -1 });
    const order = lastTask ? lastTask.order + 1 : 0;

    const task = await Task.create({
      title: title.trim(),
      description: description ? description.trim() : '',
      project: projectId,
      columnId: targetCol,
      order,
      priority: priority || 'medium',
      dueDate: dueDate || null,
      assignees: Array.isArray(assignees) ? assignees : [],
      labels: Array.isArray(labels) ? labels : [],
      checklist: Array.isArray(checklist) ? checklist : [],
      createdBy: req.user._id
    });

    const populatedTask = await Task.findById(task._id)
      .populate('assignees', 'name username avatar roleTitle email')
      .populate('createdBy', 'name username avatar');

    const resultTask = { ...populatedTask.toObject(), commentCount: 0 };

    // Broadcast via WebSockets
    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('task:created', resultTask);
    }

    // Send notifications to assignees
    if (Array.isArray(assignees)) {
      for (const uid of assignees) {
        if (uid.toString() !== req.user._id.toString()) {
          const notif = await Notification.create({
            recipient: uid,
            sender: req.user._id,
            project: projectId,
            task: task._id,
            type: 'task_assigned',
            message: `${req.user.name} assigned you to task: "${task.title}".`
          });
          if (io) {
            io.to(`user:${uid}`).emit('notification:new', notif);
          }
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task: resultTask
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update task details (title, description, priority, assignees, checklist, etc.)
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const { title, description, priority, dueDate, assignees, labels, checklist, columnId } = req.body;

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (labels !== undefined) task.labels = labels;
    if (columnId !== undefined) task.columnId = columnId;

    // Detect new assignees to notify
    const previousAssignees = task.assignees.map(a => a.toString());
    if (assignees !== undefined) {
      task.assignees = assignees;
    }

    if (checklist !== undefined) {
      task.checklist = checklist;
    }

    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignees', 'name username avatar roleTitle email')
      .populate('createdBy', 'name username avatar');

    const commentCount = await Comment.countDocuments({ task: task._id });
    const resultTask = { ...populated.toObject(), commentCount };

    // Broadcast update
    const io = getIO();
    if (io) {
      io.to(`project:${task.project}`).emit('task:updated', resultTask);
    }

    // Notify newly added assignees
    if (Array.isArray(assignees)) {
      for (const uid of assignees) {
        if (!previousAssignees.includes(uid.toString()) && uid.toString() !== req.user._id.toString()) {
          const notif = await Notification.create({
            recipient: uid,
            sender: req.user._id,
            project: task.project,
            task: task._id,
            type: 'task_assigned',
            message: `${req.user.name} assigned you to task: "${task.title}".`
          });
          if (io) {
            io.to(`user:${uid}`).emit('notification:new', notif);
          }
        }
      }
    }

    res.json({
      success: true,
      message: 'Task updated successfully',
      task: resultTask
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PATCH /api/tasks/:id/move
// @desc    Move task to another column or reorder
router.patch('/:id/move', auth, async (req, res) => {
  try {
    const { targetColumnId, newOrder } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const previousCol = task.columnId;
    task.columnId = targetColumnId || task.columnId;
    if (typeof newOrder === 'number') {
      task.order = newOrder;
    }

    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignees', 'name username avatar roleTitle email')
      .populate('createdBy', 'name username avatar');

    const commentCount = await Comment.countDocuments({ task: task._id });
    const resultTask = { ...populated.toObject(), commentCount };

    // Real-time broadcast
    const io = getIO();
    if (io) {
      io.to(`project:${task.project}`).emit('task:moved', {
        taskId: task._id,
        sourceCol: previousCol,
        destCol: task.columnId,
        newOrder: task.order,
        task: resultTask
      });
    }

    res.json({
      success: true,
      message: 'Task moved successfully',
      task: resultTask
    });
  } catch (error) {
    console.error('Move task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete a task
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const projectId = task.project;
    const taskId = task._id;

    await Comment.deleteMany({ task: taskId });
    await Notification.deleteMany({ task: taskId });
    await Task.findByIdAndDelete(taskId);

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('task:deleted', { taskId, projectId });
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
