/**
 * =========================================================================
 * EXPRESS.JS + SOCKET.IO SERVER - PROJECT MANAGEMENT TOOL (TASK 3)
 * =========================================================================
 * 
 * Active Database: MongoDB Atlas ('INTERNSHIP_TASK3')
 * REST API Base:   http://localhost:5002/api
 * WebSockets:      Enabled (Socket.IO for live collaboration & notifications)
 * Frontend UI:     http://localhost:5002
 * =========================================================================
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { connectDB, getDatabaseStatus } = require('./config/db');
const { initSockets } = require('./sockets/socketHandler');

const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const commentRoutes = require('./routes/commentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5002;

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});
initSockets(io);

// Connect to MongoDB Atlas
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = getDatabaseStatus();
  res.json({
    status: 'online',
    app: 'CodeAlpha Project Management Tool (Task 3)',
    database: dbStatus.mode,
    databaseName: dbStatus.databaseName,
    isConnected: dbStatus.isConnected,
    websockets: 'active (Socket.IO)',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth (register, login, me, users)',
      projects: '/api/projects (list, create, :id, members)',
      tasks: '/api/tasks (list by project, create, update, :id/move, delete)',
      comments: '/api/comments (list by task, create)',
      notifications: '/api/notifications (list, :id/read, read-all)'
    }
  });
});

// Fallback for client-side routing
app.get('*', (req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start Server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Project Management Tool Server running on port ${PORT}`);
  console.log(`📂 Database: MongoDB Atlas -> 'INTERNSHIP_TASK3'`);
  console.log(`⚡ WebSockets: Enabled for real-time collaboration`);
  console.log(`🌐 Frontend App: http://localhost:${PORT}`);
  console.log(`🔌 REST API Base: http://localhost:${PORT}/api`);
  console.log(`====================================================`);
});

module.exports = { app, server };
