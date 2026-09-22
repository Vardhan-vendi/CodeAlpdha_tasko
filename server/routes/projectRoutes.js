const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const { getIO } = require('../sockets/socketHandler');

// @route   GET /api/projects
// @desc    Get all projects user belongs to
router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id }
      ]
    })
      .populate('owner', 'name username avatar roleTitle')
      .populate('members.user', 'name username avatar roleTitle')
      .sort({ updatedAt: -1 });

    // Include task counts per project
    const projectList = await Promise.all(
      projects.map(async (p) => {
        const taskCount = await Task.countDocuments({ project: p._id });
        const doneCount = await Task.countDocuments({ project: p._id, columnId: 'done' });
        return {
          ...p.toObject(),
          stats: {
            totalTasks: taskCount,
            completedTasks: doneCount,
            progress: taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0
          }
        };
      })
    );

    res.json({
      success: true,
      projects: projectList
    });
  } catch (error) {
    console.error('Fetch projects error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/projects/:id
// @desc    Get single project details
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name username avatar roleTitle email')
      .populate('members.user', 'name username avatar roleTitle email');

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Check membership
    const isMember = project.owner._id.equals(req.user._id) ||
      project.members.some(m => m.user._id.equals(req.user._id));

    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied to this project' });
    }

    res.json({
      success: true,
      project
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/projects
// @desc    Create a new project
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, category, color, memberIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Project name is required' });
    }

    const members = [{ user: req.user._id, role: 'owner' }];

    if (Array.isArray(memberIds)) {
      memberIds.forEach((uid) => {
        if (uid && uid.toString() !== req.user._id.toString()) {
          members.push({ user: uid, role: 'member' });
        }
      });
    }

    const project = await Project.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      category: category || 'General',
      color: color || '#6366f1',
      owner: req.user._id,
      members
    });

    const populatedProject = await Project.findById(project._id)
      .populate('owner', 'name username avatar roleTitle')
      .populate('members.user', 'name username avatar roleTitle');

    // Notify added members
    const io = getIO();
    for (const m of members) {
      if (m.user.toString() !== req.user._id.toString()) {
        const notif = await Notification.create({
          recipient: m.user,
          sender: req.user._id,
          project: project._id,
          type: 'project_invite',
          message: `${req.user.name} added you to the project "${project.name}".`
        });
        if (io) {
          io.to(`user:${m.user}`).emit('notification:new', notif);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project: populatedProject
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/projects/:id
// @desc    Update project
router.put('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Only owner or admin can update
    const isOwner = project.owner.equals(req.user._id);
    const isAdmin = project.members.some(m => m.user.equals(req.user._id) && m.role === 'admin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only project owners and admins can edit project settings' });
    }

    const { name, description, category, color } = req.body;
    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();
    if (category) project.category = category;
    if (color) project.color = color;

    await project.save();

    const updated = await Project.findById(project._id)
      .populate('owner', 'name username avatar roleTitle')
      .populate('members.user', 'name username avatar roleTitle');

    // Broadcast update to project room
    const io = getIO();
    if (io) {
      io.to(`project:${project._id}`).emit('project:updated', updated);
    }

    res.json({
      success: true,
      message: 'Project updated',
      project: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/projects/:id
// @desc    Delete project
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the project owner can delete this project' });
    }

    // Cascade delete tasks, comments, notifications
    await Task.deleteMany({ project: project._id });
    await Comment.deleteMany({ project: project._id });
    await Notification.deleteMany({ project: project._id });
    await Project.findByIdAndDelete(project._id);

    const io = getIO();
    if (io) {
      io.to(`project:${project._id}`).emit('project:deleted', { projectId: project._id });
    }

    res.json({
      success: true,
      message: 'Project and all related tasks deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/projects/:id/members
// @desc    Add member to project
router.post('/:id/members', auth, async (req, res) => {
  try {
    const { userId, role } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Check if already member
    const exists = project.members.some(m => m.user.toString() === userId);
    if (exists) {
      return res.status(400).json({ success: false, message: 'User is already a project member' });
    }

    project.members.push({
      user: userId,
      role: role || 'member'
    });

    await project.save();

    const updated = await Project.findById(project._id)
      .populate('owner', 'name username avatar roleTitle')
      .populate('members.user', 'name username avatar roleTitle');

    // Notify user
    const notif = await Notification.create({
      recipient: userId,
      sender: req.user._id,
      project: project._id,
      type: 'project_invite',
      message: `${req.user.name} added you to project "${project.name}".`
    });

    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', notif);
      io.to(`project:${project._id}`).emit('project:updated', updated);
    }

    res.json({
      success: true,
      message: 'Member added successfully',
      project: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
