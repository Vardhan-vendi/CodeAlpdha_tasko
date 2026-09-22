const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    default: 0
  }
}, { _id: false });

const memberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'member'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  category: {
    type: String,
    default: 'General'
  },
  color: {
    type: String,
    default: '#6366f1' // Indigo default
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [memberSchema],
  columns: {
    type: [columnSchema],
    default: [
      { id: 'todo', title: 'To Do', order: 0 },
      { id: 'in_progress', title: 'In Progress', order: 1 },
      { id: 'review', title: 'In Review', order: 2 },
      { id: 'done', title: 'Completed', order: 3 }
    ]
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Project', projectSchema);
