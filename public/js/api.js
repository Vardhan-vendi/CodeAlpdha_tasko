/**
 * API Service Client for TaskFlow Project Management Tool
 */

const API = (() => {
  const BASE_URL = '/api';

  const getToken = () => localStorage.getItem('taskflow_token');
  const setToken = (t) => localStorage.setItem('taskflow_token', t);
  const removeToken = () => localStorage.removeItem('taskflow_token');

  const getCurrentUser = () => {
    try {
      const u = localStorage.getItem('taskflow_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  };

  const setCurrentUser = (u) => {
    if (u) localStorage.setItem('taskflow_user', JSON.stringify(u));
    else localStorage.removeItem('taskflow_user');
  };

  async function request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
  }

  return {
    getToken,
    setToken,
    removeToken,
    getCurrentUser,
    setCurrentUser,

    // Auth
    auth: {
      login: (login, password) => request('/auth/login', { method: 'POST', body: { login, password } }),
      register: (userData) => request('/auth/register', { method: 'POST', body: userData }),
      getMe: () => request('/auth/me'),
      getUsers: () => request('/auth/users')
    },

    // Projects
    projects: {
      getAll: () => request('/projects'),
      getOne: (id) => request(`/projects/${id}`),
      create: (data) => request('/projects', { method: 'POST', body: data }),
      update: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: data }),
      delete: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
      addMember: (id, userId, role) => request(`/projects/${id}/members`, { method: 'POST', body: { userId, role } })
    },

    // Tasks
    tasks: {
      getByProject: (projectId) => request(`/tasks?project=${projectId}`),
      getOne: (id) => request(`/tasks/${id}`),
      create: (data) => request('/tasks', { method: 'POST', body: data }),
      update: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: data }),
      move: (id, targetColumnId, newOrder) => request(`/tasks/${id}/move`, { method: 'PATCH', body: { targetColumnId, newOrder } }),
      delete: (id) => request(`/tasks/${id}`, { method: 'DELETE' })
    },

    // Comments
    comments: {
      getByTask: (taskId) => request(`/comments?task=${taskId}`),
      create: (taskId, text) => request('/comments', { method: 'POST', body: { taskId, text } })
    },

    // Notifications
    notifications: {
      getAll: () => request('/notifications'),
      markRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
      markAllRead: () => request('/notifications/read-all', { method: 'PUT' })
    }
  };
})();
