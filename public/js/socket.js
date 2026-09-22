/**
 * Real-time WebSocket Client for TaskFlow
 */

const Realtime = (() => {
  let socket = null;
  let currentJoinedProject = null;

  function init() {
    if (typeof io === 'undefined') {
      console.warn('Socket.IO library not detected.');
      return;
    }

    socket = io();

    socket.on('connect', () => {
      console.log('⚡ Connected to TaskFlow WebSocket server:', socket.id);
      updateStatusIndicator(true);

      // Re-join user room
      const user = API.getCurrentUser();
      if (user && user._id) {
        joinUser(user._id);
      }

      // Re-join current project room
      if (currentJoinedProject) {
        joinProject(currentJoinedProject);
      }
    });

    socket.on('disconnect', () => {
      console.log('⚡ Disconnected from WebSocket server');
      updateStatusIndicator(false);
    });

    // Real-time Event Handlers
    socket.on('task:created', (task) => {
      if (window.app && typeof window.app.onTaskCreatedSocket === 'function') {
        window.app.onTaskCreatedSocket(task);
      }
    });

    socket.on('task:moved', (payload) => {
      if (window.app && typeof window.app.onTaskMovedSocket === 'function') {
        window.app.onTaskMovedSocket(payload);
      }
    });

    socket.on('task:updated', (task) => {
      if (window.app && typeof window.app.onTaskUpdatedSocket === 'function') {
        window.app.onTaskUpdatedSocket(task);
      }
    });

    socket.on('task:deleted', (payload) => {
      if (window.app && typeof window.app.onTaskDeletedSocket === 'function') {
        window.app.onTaskDeletedSocket(payload);
      }
    });

    socket.on('comment:added', (payload) => {
      if (window.app && typeof window.app.onCommentAddedSocket === 'function') {
        window.app.onCommentAddedSocket(payload);
      }
    });

    socket.on('notification:new', (notif) => {
      if (window.app && typeof window.app.onNotificationReceivedSocket === 'function') {
        window.app.onNotificationReceivedSocket(notif);
      }
    });

    socket.on('project:updated', (project) => {
      if (window.app && typeof window.app.onProjectUpdatedSocket === 'function') {
        window.app.onProjectUpdatedSocket(project);
      }
    });
  }

  function updateStatusIndicator(connected) {
    const el = document.getElementById('socketStatus');
    if (!el) return;
    if (connected) {
      el.style.background = 'rgba(16, 185, 129, 0.12)';
      el.style.color = '#10b981';
      el.querySelector('.status-text').textContent = 'Live Sync';
      el.querySelector('.pulse-dot').style.backgroundColor = '#10b981';
    } else {
      el.style.background = 'rgba(239, 68, 68, 0.12)';
      el.style.color = '#ef4444';
      el.querySelector('.status-text').textContent = 'Offline';
      el.querySelector('.pulse-dot').style.backgroundColor = '#ef4444';
    }
  }

  function joinProject(projectId) {
    if (!socket) return;
    if (currentJoinedProject && currentJoinedProject !== projectId) {
      socket.emit('leave_project', currentJoinedProject);
    }
    currentJoinedProject = projectId;
    socket.emit('join_project', projectId);
  }

  function joinUser(userId) {
    if (!socket) return;
    socket.emit('join_user', userId);
  }

  return {
    init,
    joinProject,
    joinUser
  };
})();
