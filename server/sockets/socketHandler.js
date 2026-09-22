let ioInstance = null;

function initSockets(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    // Join project room for real-time board updates
    socket.on('join_project', (projectId) => {
      if (projectId) {
        socket.join(`project:${projectId}`);
      }
    });

    // Leave project room
    socket.on('leave_project', (projectId) => {
      if (projectId) {
        socket.leave(`project:${projectId}`);
      }
    });

    // Join personal user room for direct notifications
    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });

    socket.on('disconnect', () => {
      // Clean up if needed
    });
  });

  return io;
}

function getIO() {
  return ioInstance;
}

module.exports = {
  initSockets,
  getIO
};
