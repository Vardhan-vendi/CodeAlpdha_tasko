/**
 * Main Application Controller for TaskFlow (Task 3)
 */

window.app = (() => {
  // State
  let currentUser = null;
  let allProjects = [];
  let currentProject = null;
  let currentTasks = [];
  let allUsers = [];
  let notifications = [];

  // Active Filters
  let activePriorityFilter = 'all';
  let activeAssigneeFilter = 'all';
  let searchQuery = '';

  // Currently open task detail
  let currentOpenTaskId = null;
  let saveDebounceTimer = null;
  let draggedTaskId = null;

  // Initialize
  async function init() {
    initTheme();
    Realtime.init();

    // Check stored user or auto-login demo user
    try {
      const storedUser = API.getCurrentUser();
      const token = API.getToken();

      if (token && storedUser) {
        try {
          const res = await API.auth.getMe();
          currentUser = res.user;
          API.setCurrentUser(currentUser);
        } catch {
          // Token expired, clear
          API.removeToken();
          API.setCurrentUser(null);
          currentUser = null;
        }
      }

      // If still not logged in, auto-login as demo user Alex Rivera for zero-barrier preview
      if (!currentUser) {
        await autoLoginDemo();
      }

      updateUserUI();
      await loadAllUsers();
      await loadProjects();
      await loadNotifications();
    } catch (err) {
      console.error('Initialization error:', err);
      showToast('Error initializing app: ' + err.message, 'error');
    }
  }

  // -------------------------------------------------------------
  // Theme Toggle
  // -------------------------------------------------------------
  function initTheme() {
    const saved = localStorage.getItem('taskflow_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  }

  function toggleTheme() {
    const curr = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = curr === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('taskflow_theme', next);
    updateThemeIcon(next);
  }

  function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    if (theme === 'dark') {
      icon.className = 'bi bi-sun-fill';
    } else {
      icon.className = 'bi bi-moon-stars-fill';
    }
  }

  // -------------------------------------------------------------
  // Authentication & Demo Accounts
  // -------------------------------------------------------------
  async function autoLoginDemo() {
    try {
      const res = await API.auth.login('alex_rivera', 'password123');
      API.setToken(res.token);
      API.setCurrentUser(res.user);
      currentUser = res.user;
      Realtime.joinUser(currentUser._id);
    } catch (err) {
      console.warn('Auto-login as demo user failed:', err.message);
    }
  }

  function updateUserUI() {
    const container = document.getElementById('userMenuContainer');
    if (!container) return;

    if (currentUser) {
      const initials = getInitials(currentUser.name);
      container.innerHTML = `
        <div class="user-profile-chip" onclick="app.toggleUserMenu(event)">
          ${currentUser.avatar ? `<img src="${currentUser.avatar}" class="avatar-img" alt="${escapeHtml(currentUser.name)}" />` : `<span class="avatar-circle">${initials}</span>`}
          <span class="user-chip-name">${escapeHtml(currentUser.name)}</span>
          <i class="bi bi-chevron-down" style="font-size: 0.75rem; color: var(--text-muted);"></i>
        </div>
        <div class="notifications-dropdown" id="userDropdownMenu" style="display: none; top: 48px; right: 0; width: 260px;">
          <div class="dropdown-header">
            <div>
              <strong>${escapeHtml(currentUser.name)}</strong>
              <small style="display: block; color: var(--text-muted);">${escapeHtml(currentUser.roleTitle || 'Member')}</small>
            </div>
          </div>
          <div style="padding: 0.5rem;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); padding: 0.35rem 0.5rem;">SWITCH ACTIVE USER (TEST COLLABORATION)</div>
            <button class="text-btn" style="display: flex; align-items: center; gap: 0.5rem; width: 100%; text-align: left; padding: 0.4rem 0.5rem; color: var(--text-primary);" onclick="app.quickDemoLogin('alex_rivera')">
              <span class="avatar-circle" style="width: 22px; height: 22px; font-size: 0.6rem;">AR</span> Alex Rivera (PM)
            </button>
            <button class="text-btn" style="display: flex; align-items: center; gap: 0.5rem; width: 100%; text-align: left; padding: 0.4rem 0.5rem; color: var(--text-primary);" onclick="app.quickDemoLogin('sarah_chen')">
              <span class="avatar-circle" style="width: 22px; height: 22px; font-size: 0.6rem;">SC</span> Sarah Chen (Dev Lead)
            </button>
            <button class="text-btn" style="display: flex; align-items: center; gap: 0.5rem; width: 100%; text-align: left; padding: 0.4rem 0.5rem; color: var(--text-primary);" onclick="app.quickDemoLogin('marcus_j')">
              <span class="avatar-circle" style="width: 22px; height: 22px; font-size: 0.6rem;">MJ</span> Marcus Johnson (Frontend)
            </button>
            <button class="text-btn" style="display: flex; align-items: center; gap: 0.5rem; width: 100%; text-align: left; padding: 0.4rem 0.5rem; color: var(--text-primary);" onclick="app.quickDemoLogin('elena_r')">
              <span class="avatar-circle" style="width: 22px; height: 22px; font-size: 0.6rem;">ER</span> Elena Rostova (Designer)
            </button>
          </div>
          <div style="padding: 0.5rem; border-top: 1px solid var(--border-color);">
            <button class="btn btn-sm btn-outline btn-block" onclick="app.logout()">
              <i class="bi bi-box-arrow-right"></i> Sign Out
            </button>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="app.openAuthModal('login')">
          <i class="bi bi-box-arrow-in-right"></i> Sign In
        </button>
      `;
    }
  }

  function toggleUserMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('userDropdownMenu');
    if (menu) {
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
  }

  async function quickDemoLogin(username) {
    try {
      const res = await API.auth.login(username, 'password123');
      API.setToken(res.token);
      API.setCurrentUser(res.user);
      currentUser = res.user;
      Realtime.joinUser(currentUser._id);
      updateUserUI();
      closeAuthModal();
      showToast(`Switched user to ${currentUser.name}`, 'success');
      await loadProjects();
      await loadNotifications();
    } catch (err) {
      showToast('Quick demo login error: ' + err.message, 'error');
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const login = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    errEl.style.display = 'none';

    try {
      const res = await API.auth.login(login, password);
      API.setToken(res.token);
      API.setCurrentUser(res.user);
      currentUser = res.user;
      Realtime.joinUser(currentUser._id);
      updateUserUI();
      closeAuthModal();
      showToast(`Welcome back, ${currentUser.name}!`, 'success');
      await loadProjects();
      await loadNotifications();
    } catch (err) {
      errEl.textContent = err.message || 'Login failed';
      errEl.style.display = 'block';
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const roleTitle = document.getElementById('regRole').value.trim();
    const password = document.getElementById('regPassword').value;
    const errEl = document.getElementById('registerError');
    errEl.style.display = 'none';

    try {
      const res = await API.auth.register({ name, username, email, password, roleTitle });
      API.setToken(res.token);
      API.setCurrentUser(res.user);
      currentUser = res.user;
      Realtime.joinUser(currentUser._id);
      updateUserUI();
      closeAuthModal();
      showToast('Account created successfully!', 'success');
      await loadAllUsers();
      await loadProjects();
    } catch (err) {
      errEl.textContent = err.message || 'Registration failed';
      errEl.style.display = 'block';
    }
  }

  function logout() {
    API.removeToken();
    API.setCurrentUser(null);
    currentUser = null;
    updateUserUI();
    showToast('Signed out successfully', 'info');
    openAuthModal('login');
  }

  // -------------------------------------------------------------
  // Projects Management
  // -------------------------------------------------------------
  async function loadAllUsers() {
    try {
      const res = await API.auth.getUsers();
      allUsers = res.users || [];
    } catch (err) {
      console.warn('Error loading users:', err);
    }
  }

  async function loadProjects() {
    if (!currentUser) return;
    try {
      const res = await API.projects.getAll();
      allProjects = res.projects || [];

      const select = document.getElementById('projectSelect');
      if (!select) return;

      if (allProjects.length === 0) {
        select.innerHTML = '<option value="">No projects found</option>';
        renderEmptyBoard();
        return;
      }

      select.innerHTML = allProjects.map(p => `
        <option value="${p._id}" ${currentProject && currentProject._id === p._id ? 'selected' : ''}>
          ${escapeHtml(p.name)}
        </option>
      `).join('');

      // Keep current selected or default to first
      const selectedId = currentProject ? currentProject._id : allProjects[0]._id;
      await switchProject(selectedId);
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  }

  async function switchProject(projectId) {
    if (!projectId) return;
    try {
      const res = await API.projects.getOne(projectId);
      currentProject = res.project;
      Realtime.joinProject(currentProject._id);

      updateProjectHeroUI();
      await loadTasks();
    } catch (err) {
      console.error('Switch project error:', err);
      showToast('Failed to load project details', 'error');
    }
  }

  function updateProjectHeroUI() {
    if (!currentProject) return;

    document.getElementById('heroProjectName').textContent = currentProject.name;
    document.getElementById('heroProjectDesc').textContent = currentProject.description || 'No description provided';
    document.getElementById('heroProjectCategory').textContent = currentProject.category || 'General';
    document.getElementById('heroProjectColor').style.backgroundColor = currentProject.color || '#6366f1';

    // Members list in hero
    const membersEl = document.getElementById('heroMembersList');
    if (membersEl) {
      const members = currentProject.members || [];
      membersEl.innerHTML = members.map(m => {
        const u = m.user;
        if (!u) return '';
        const initials = getInitials(u.name);
        return u.avatar
          ? `<img src="${u.avatar}" title="${escapeHtml(u.name)} (${m.role})" alt="${escapeHtml(u.name)}" />`
          : `<span class="avatar-circle" title="${escapeHtml(u.name)} (${m.role})">${initials}</span>`;
      }).join('');
    }

    // Populate assignee filter dropdown
    const assigneeFilterEl = document.getElementById('assigneeFilter');
    if (assigneeFilterEl) {
      const members = currentProject.members || [];
      assigneeFilterEl.innerHTML = `
        <option value="all">Everyone</option>
        ${members.map(m => `<option value="${m.user._id}">${escapeHtml(m.user.name)}</option>`).join('')}
      `;
      assigneeFilterEl.value = activeAssigneeFilter;
    }
  }

  async function handleCreateProject(e) {
    e.preventDefault();
    const name = document.getElementById('newProjectName').value.trim();
    const description = document.getElementById('newProjectDesc').value.trim();
    const category = document.getElementById('newProjectCategory').value.trim();
    const color = document.getElementById('newProjectColor').value;

    // Collect invited member IDs
    const memberCheckboxes = document.querySelectorAll('#newProjectMembersBox input[type="checkbox"]:checked');
    const memberIds = Array.from(memberCheckboxes).map(cb => cb.value);

    try {
      const res = await API.projects.create({ name, description, category, color, memberIds });
      closeNewProjectModal();
      showToast(`Project "${res.project.name}" created!`, 'success');
      await loadProjects();
      await switchProject(res.project._id);
    } catch (err) {
      showToast(err.message || 'Failed to create project', 'error');
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!currentProject) return;
    const userId = document.getElementById('inviteUserSelect').value;
    const role = document.getElementById('inviteUserRole').value;

    try {
      const res = await API.projects.addMember(currentProject._id, userId, role);
      currentProject = res.project;
      closeInviteModal();
      updateProjectHeroUI();
      showToast('Team member added to project!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to add member', 'error');
    }
  }

  // -------------------------------------------------------------
  // Tasks Management & Kanban Board
  // -------------------------------------------------------------
  async function loadTasks() {
    if (!currentProject) return;
    try {
      const res = await API.tasks.getByProject(currentProject._id);
      currentTasks = res.tasks || [];
      renderBoard();
    } catch (err) {
      console.error('Error loading tasks:', err);
    }
  }

  function renderBoard() {
    const columns = ['todo', 'in_progress', 'review', 'done'];
    const counts = { todo: 0, in_progress: 0, review: 0, done: 0 };

    // Clear all dropzones
    columns.forEach(col => {
      const dropzone = document.getElementById(`dropzone-${col}`);
      if (dropzone) dropzone.innerHTML = '';
    });

    // Filter tasks
    const filteredTasks = currentTasks.filter(task => {
      // Priority filter
      if (activePriorityFilter !== 'all' && task.priority !== activePriorityFilter) {
        return false;
      }
      // Assignee filter
      if (activeAssigneeFilter !== 'all') {
        const hasAssignee = task.assignees && task.assignees.some(a => (a._id || a) === activeAssigneeFilter);
        if (!hasAssignee) return false;
      }
      // Search keyword filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title && task.title.toLowerCase().includes(q);
        const matchesDesc = task.description && task.description.toLowerCase().includes(q);
        const matchesLabel = task.labels && task.labels.some(l => l.toLowerCase().includes(q));
        const matchesAssignee = task.assignees && task.assignees.some(a => a.name && a.name.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesLabel && !matchesAssignee) return false;
      }
      return true;
    });

    // Render cards into respective columns
    filteredTasks.forEach(task => {
      const col = task.columnId || 'todo';
      if (counts[col] !== undefined) counts[col]++;

      const dropzone = document.getElementById(`dropzone-${col}`);
      if (dropzone) {
        dropzone.appendChild(createTaskCardElement(task));
      }
    });

    // Update column counters
    columns.forEach(col => {
      const countEl = document.getElementById(`count-${col}`);
      if (countEl) countEl.textContent = counts[col] || 0;
    });

    // Update board stats
    document.getElementById('statTotalTasks').textContent = currentTasks.length;
    const doneTasks = currentTasks.filter(t => t.columnId === 'done').length;
    document.getElementById('statDoneTasks').textContent = doneTasks;
  }

  function createTaskCardElement(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-task-id', task._id);
    card.onclick = () => openTaskDetailModal(task._id);

    // Drag events
    card.ondragstart = (e) => handleDragStart(e, task._id);
    card.ondragend = handleDragEnd;

    // Priority pill
    const priority = task.priority || 'medium';

    // Checklist stats
    let checklistHtml = '';
    if (Array.isArray(task.checklist) && task.checklist.length > 0) {
      const total = task.checklist.length;
      const completed = task.checklist.filter(c => c.completed).length;
      const pct = Math.round((completed / total) * 100);
      checklistHtml = `
        <div class="card-checklist-bar">
          <i class="bi bi-check2-square"></i>
          <span>${completed}/${total}</span>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }

    // Due date
    let dueDateHtml = '';
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      const isOverdue = d < new Date() && task.columnId !== 'done';
      const formatted = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      dueDateHtml = `
        <span class="card-due-date ${isOverdue ? 'overdue' : ''}">
          <i class="bi bi-calendar-event"></i> ${formatted}
        </span>
      `;
    }

    // Labels
    let labelsHtml = '';
    if (Array.isArray(task.labels) && task.labels.length > 0) {
      labelsHtml = `
        <div class="card-labels">
          ${task.labels.map(l => `<span class="label-chip">${escapeHtml(l)}</span>`).join('')}
        </div>
      `;
    }

    // Assignees stack
    let assigneesHtml = '';
    if (Array.isArray(task.assignees) && task.assignees.length > 0) {
      assigneesHtml = `
        <div class="assignee-stack">
          ${task.assignees.map(a => {
            const initials = getInitials(a.name || 'User');
            return a.avatar
              ? `<img src="${a.avatar}" title="${escapeHtml(a.name)}" alt="${escapeHtml(a.name)}" />`
              : `<span class="avatar-circle" title="${escapeHtml(a.name)}">${initials}</span>`;
          }).join('')}
        </div>
      `;
    }

    // Comments count
    const commentCount = task.commentCount || 0;
    const commentHtml = commentCount > 0 ? `
      <span class="comment-bubble-count">
        <i class="bi bi-chat-left-dots-fill"></i> ${commentCount}
      </span>
    ` : '';

    card.innerHTML = `
      <div class="card-top-row">
        <span class="priority-pill ${priority}">${priority}</span>
        ${labelsHtml}
      </div>
      <div class="card-title">${escapeHtml(task.title)}</div>
      ${task.description ? `<div class="card-desc">${escapeHtml(task.description)}</div>` : ''}
      ${checklistHtml}
      <div class="card-footer-row">
        ${dueDateHtml || '<span></span>'}
        <div class="card-meta-right">
          ${commentHtml}
          ${assigneesHtml}
        </div>
      </div>
    `;

    return card;
  }

  // -------------------------------------------------------------
  // HTML5 Drag and Drop Handlers
  // -------------------------------------------------------------
  function handleDragStart(e, taskId) {
    draggedTaskId = taskId;
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      const el = document.querySelector(`[data-task-id="${taskId}"]`);
      if (el) el.classList.add('dragging');
    }, 0);
  }

  function handleDragEnd(e) {
    draggedTaskId = null;
    document.querySelectorAll('.task-card.dragging').forEach(c => c.classList.remove('dragging'));
    document.querySelectorAll('.cards-dropzone.drag-over').forEach(dz => dz.classList.remove('drag-over'));
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const dropzone = e.currentTarget;
    if (dropzone && !dropzone.classList.contains('drag-over')) {
      dropzone.classList.add('drag-over');
    }
  }

  function handleDragLeave(e) {
    const dropzone = e.currentTarget;
    if (dropzone) {
      dropzone.classList.remove('drag-over');
    }
  }

  async function handleDrop(e, targetColumnId) {
    e.preventDefault();
    const dropzone = e.currentTarget;
    if (dropzone) dropzone.classList.remove('drag-over');

    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    const task = currentTasks.find(t => t._id === taskId);
    if (!task) return;

    // Check if column changed
    if (task.columnId === targetColumnId) return;

    // Optimistic UI update
    const previousCol = task.columnId;
    task.columnId = targetColumnId;
    renderBoard();

    try {
      await API.tasks.move(taskId, targetColumnId);
      showToast(`Task moved to ${formatColumnTitle(targetColumnId)}`, 'info');
    } catch (err) {
      // Revert on error
      task.columnId = previousCol;
      renderBoard();
      showToast('Failed to move task: ' + err.message, 'error');
    }
  }

  // -------------------------------------------------------------
  // Task Detail & Comments Modal
  // -------------------------------------------------------------
  async function openTaskDetailModal(taskId) {
    currentOpenTaskId = taskId;
    const task = currentTasks.find(t => t._id === taskId);
    if (!task) return;

    const modal = document.getElementById('taskDetailModal');
    modal.style.display = 'flex';

    document.getElementById('modalColumnBadge').textContent = formatColumnTitle(task.columnId);
    document.getElementById('modalTaskTitle').value = task.title || '';
    document.getElementById('modalTaskDesc').value = task.description || '';
    document.getElementById('modalTaskPriority').value = task.priority || 'medium';
    document.getElementById('modalTaskColumn').value = task.columnId || 'todo';
    document.getElementById('modalTaskDueDate').value = task.dueDate ? task.dueDate.substring(0, 10) : '';
    document.getElementById('modalTaskLabels').value = Array.isArray(task.labels) ? task.labels.join(', ') : '';

    // Created by
    document.getElementById('modalTaskCreatedBy').textContent = task.createdBy ? task.createdBy.name : 'Unknown';
    document.getElementById('modalTaskCreatedAt').textContent = new Date(task.createdAt).toLocaleString();

    // Checklist
    renderModalChecklist(task);

    // Assignees checkboxes
    renderModalAssignees(task);

    // Load comments
    await loadTaskComments(taskId);
  }

  function closeTaskDetailModal() {
    document.getElementById('taskDetailModal').style.display = 'none';
    currentOpenTaskId = null;
  }

  function renderModalChecklist(task) {
    const list = document.getElementById('modalChecklistItems');
    const items = task.checklist || [];
    const completed = items.filter(i => i.completed).length;
    const total = items.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('modalChecklistProgress').textContent = `${completed}/${total} completed`;
    document.getElementById('modalChecklistBar').style.width = `${pct}%`;

    list.innerHTML = items.map((item, idx) => `
      <div class="checklist-item-row ${item.completed ? 'completed' : ''}">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="app.toggleChecklistItem(${idx}, this.checked)" />
          <span>${escapeHtml(item.text)}</span>
        </label>
        <button class="icon-btn-ghost" onclick="app.removeChecklistItem(${idx})" style="font-size: 0.8rem; color: var(--danger);">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `).join('');
  }

  function renderModalAssignees(task) {
    const box = document.getElementById('modalAssigneesBox');
    if (!currentProject) return;

    const assignedIds = (task.assignees || []).map(a => a._id || a);
    box.innerHTML = (currentProject.members || []).map(m => {
      const u = m.user;
      if (!u) return '';
      const isChecked = assignedIds.includes(u._id);
      return `
        <label class="assignee-checkbox-row">
          <input type="checkbox" value="${u._id}" ${isChecked ? 'checked' : ''} onchange="app.saveTaskDetailsDebounced()" />
          <span>${escapeHtml(u.name)} (${escapeHtml(u.roleTitle || 'Member')})</span>
        </label>
      `;
    }).join('');
  }

  function saveTaskDetailsDebounced() {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(saveTaskDetails, 400);
  }

  async function saveTaskDetails() {
    if (!currentOpenTaskId) return;
    const task = currentTasks.find(t => t._id === currentOpenTaskId);
    if (!task) return;

    const title = document.getElementById('modalTaskTitle').value.trim();
    const description = document.getElementById('modalTaskDesc').value.trim();
    const priority = document.getElementById('modalTaskPriority').value;
    const columnId = document.getElementById('modalTaskColumn').value;
    const dueDate = document.getElementById('modalTaskDueDate').value;
    const labelsRaw = document.getElementById('modalTaskLabels').value;
    const labels = labelsRaw.split(',').map(l => l.trim()).filter(Boolean);

    // Selected assignees
    const assigneeBoxes = document.querySelectorAll('#modalAssigneesBox input[type="checkbox"]:checked');
    const assignees = Array.from(assigneeBoxes).map(cb => cb.value);

    try {
      const res = await API.tasks.update(currentOpenTaskId, {
        title,
        description,
        priority,
        columnId,
        dueDate,
        labels,
        assignees,
        checklist: task.checklist
      });

      // Update in local cache & re-render board
      const idx = currentTasks.findIndex(t => t._id === currentOpenTaskId);
      if (idx !== -1) {
        currentTasks[idx] = res.task;
        renderBoard();
      }
      document.getElementById('modalColumnBadge').textContent = formatColumnTitle(res.task.columnId);
    } catch (err) {
      showToast('Error saving changes: ' + err.message, 'error');
    }
  }

  function toggleChecklistItem(idx, isChecked) {
    if (!currentOpenTaskId) return;
    const task = currentTasks.find(t => t._id === currentOpenTaskId);
    if (!task || !task.checklist || !task.checklist[idx]) return;

    task.checklist[idx].completed = isChecked;
    renderModalChecklist(task);
    saveTaskDetailsDebounced();
  }

  function addChecklistItem(e) {
    e.preventDefault();
    const input = document.getElementById('newCheckItemText');
    const text = input.value.trim();
    if (!text || !currentOpenTaskId) return;

    const task = currentTasks.find(t => t._id === currentOpenTaskId);
    if (!task) return;

    if (!Array.isArray(task.checklist)) task.checklist = [];
    task.checklist.push({ text, completed: false });
    input.value = '';

    renderModalChecklist(task);
    saveTaskDetailsDebounced();
  }

  function removeChecklistItem(idx) {
    if (!currentOpenTaskId) return;
    const task = currentTasks.find(t => t._id === currentOpenTaskId);
    if (!task || !task.checklist) return;

    task.checklist.splice(idx, 1);
    renderModalChecklist(task);
    saveTaskDetailsDebounced();
  }

  async function confirmDeleteCurrentTask() {
    if (!currentOpenTaskId) return;
    if (!confirm('Are you sure you want to permanently delete this task?')) return;

    const taskId = currentOpenTaskId;
    try {
      await API.tasks.delete(taskId);
      currentTasks = currentTasks.filter(t => t._id !== taskId);
      renderBoard();
      closeTaskDetailModal();
      showToast('Task deleted successfully', 'info');
    } catch (err) {
      showToast('Failed to delete task: ' + err.message, 'error');
    }
  }

  // -------------------------------------------------------------
  // Comments Management
  // -------------------------------------------------------------
  async function loadTaskComments(taskId) {
    try {
      const res = await API.comments.getByTask(taskId);
      renderComments(res.comments || []);
    } catch (err) {
      console.error('Error loading comments:', err);
    }
  }

  function renderComments(comments) {
    const stream = document.getElementById('modalCommentsStream');
    if (!stream) return;

    if (comments.length === 0) {
      stream.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">No comments yet. Start the conversation!</div>';
      return;
    }

    stream.innerHTML = comments.map(c => {
      const author = c.user || { name: 'User' };
      const initials = getInitials(author.name);
      const time = new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="comment-card">
          ${author.avatar ? `<img src="${author.avatar}" class="avatar-circle" style="width: 28px; height: 28px;" alt="${escapeHtml(author.name)}" />` : `<span class="avatar-circle" style="width: 28px; height: 28px;">${initials}</span>`}
          <div style="flex: 1;">
            <div>
              <span class="comment-author-name">${escapeHtml(author.name)}</span>
              <span class="comment-time">${time}</span>
            </div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function submitTaskComment(e) {
    e.preventDefault();
    if (!currentOpenTaskId) return;

    const input = document.getElementById('taskCommentInput');
    const text = input.value.trim();
    if (!text) return;

    try {
      const res = await API.comments.create(currentOpenTaskId, text);
      input.value = '';
      // Refresh comments and task card
      await loadTaskComments(currentOpenTaskId);

      const task = currentTasks.find(t => t._id === currentOpenTaskId);
      if (task) {
        task.commentCount = (task.commentCount || 0) + 1;
        renderBoard();
      }
    } catch (err) {
      showToast('Failed to post comment: ' + err.message, 'error');
    }
  }

  // -------------------------------------------------------------
  // Create New Task Modal
  // -------------------------------------------------------------
  function openNewTaskModal(columnId = 'todo') {
    if (!currentProject) {
      showToast('Please select or create a project first', 'warning');
      return;
    }

    const modal = document.getElementById('newTaskModal');
    modal.style.display = 'flex';
    document.getElementById('newTaskTitle').value = '';
    document.getElementById('newTaskDesc').value = '';
    document.getElementById('newTaskColumn').value = columnId;
    document.getElementById('newTaskPriority').value = 'medium';
    document.getElementById('newTaskDueDate').value = '';
    document.getElementById('newTaskLabels').value = '';

    // Populate assignees checkboxes
    const box = document.getElementById('newTaskAssigneesBox');
    box.innerHTML = (currentProject.members || []).map(m => {
      const u = m.user;
      if (!u) return '';
      return `
        <label class="assignee-checkbox-row">
          <input type="checkbox" value="${u._id}" />
          <span>${escapeHtml(u.name)} (${escapeHtml(u.roleTitle || 'Member')})</span>
        </label>
      `;
    }).join('');
  }

  function closeNewTaskModal() {
    document.getElementById('newTaskModal').style.display = 'none';
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!currentProject) return;

    const title = document.getElementById('newTaskTitle').value.trim();
    const description = document.getElementById('newTaskDesc').value.trim();
    const columnId = document.getElementById('newTaskColumn').value;
    const priority = document.getElementById('newTaskPriority').value;
    const dueDate = document.getElementById('newTaskDueDate').value;
    const labelsRaw = document.getElementById('newTaskLabels').value;
    const labels = labelsRaw.split(',').map(l => l.trim()).filter(Boolean);

    const checkedBoxes = document.querySelectorAll('#newTaskAssigneesBox input[type="checkbox"]:checked');
    const assignees = Array.from(checkedBoxes).map(cb => cb.value);

    try {
      const res = await API.tasks.create({
        title,
        description,
        project: currentProject._id,
        columnId,
        priority,
        dueDate,
        labels,
        assignees
      });

      closeNewTaskModal();
      showToast(`Task "${title}" created!`, 'success');

      // Add to local list and re-render if not already added by socket
      if (!currentTasks.some(t => t._id === res.task._id)) {
        currentTasks.push(res.task);
        renderBoard();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create task', 'error');
    }
  }

  // -------------------------------------------------------------
  // Modals & UI Toggles
  // -------------------------------------------------------------
  function openNewProjectModal() {
    document.getElementById('newProjectModal').style.display = 'flex';
    document.getElementById('newProjectName').value = '';
    document.getElementById('newProjectDesc').value = '';

    // Populate team members checklist
    const box = document.getElementById('newProjectMembersBox');
    box.innerHTML = allUsers
      .filter(u => !currentUser || u._id !== currentUser._id)
      .map(u => `
        <label class="assignee-checkbox-row">
          <input type="checkbox" value="${u._id}" />
          <span>${escapeHtml(u.name)} — <small style="color: var(--text-muted);">${escapeHtml(u.roleTitle || 'Member')}</small></span>
        </label>
      `).join('');
  }

  function closeNewProjectModal() {
    document.getElementById('newProjectModal').style.display = 'none';
  }

  function openInviteModal() {
    if (!currentProject) return;
    document.getElementById('inviteMemberModal').style.display = 'flex';

    // Populate select with users NOT in project
    const existingMemberIds = (currentProject.members || []).map(m => m.user._id);
    const eligible = allUsers.filter(u => !existingMemberIds.includes(u._id));

    const select = document.getElementById('inviteUserSelect');
    if (eligible.length === 0) {
      select.innerHTML = '<option value="">All registered users are already members!</option>';
    } else {
      select.innerHTML = `
        <option value="">Choose a team member...</option>
        ${eligible.map(u => `<option value="${u._id}">${escapeHtml(u.name)} (${escapeHtml(u.roleTitle || 'Member')})</option>`).join('')}
      `;
    }
  }

  function closeInviteModal() {
    document.getElementById('inviteMemberModal').style.display = 'none';
  }

  function openAuthModal(tab = 'login') {
    document.getElementById('authModal').style.display = 'flex';
    switchAuthTab(tab);
  }

  function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
  }

  function switchAuthTab(tab) {
    const loginBtn = document.getElementById('tabLoginBtn');
    const regBtn = document.getElementById('tabRegisterBtn');
    const loginForm = document.getElementById('loginForm');
    const regForm = document.getElementById('registerForm');

    if (tab === 'login') {
      loginBtn.classList.add('active');
      regBtn.classList.remove('active');
      loginForm.style.display = 'block';
      regForm.style.display = 'none';
    } else {
      regBtn.classList.add('active');
      loginBtn.classList.remove('active');
      regForm.style.display = 'block';
      loginForm.style.display = 'none';
    }
  }

  // -------------------------------------------------------------
  // Filter & Search Controls
  // -------------------------------------------------------------
  function setPriorityFilter(priority) {
    activePriorityFilter = priority;
    document.querySelectorAll('#priorityFilters .pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-priority') === priority);
    });
    renderBoard();
  }

  function setAssigneeFilter(userId) {
    activeAssigneeFilter = userId;
    renderBoard();
  }

  function filterTasks() {
    const input = document.getElementById('boardSearch');
    searchQuery = input.value.trim();
    document.getElementById('clearSearchBtn').style.display = searchQuery ? 'block' : 'none';
    renderBoard();
  }

  function clearSearch() {
    document.getElementById('boardSearch').value = '';
    searchQuery = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    renderBoard();
  }

  // -------------------------------------------------------------
  // Real-Time Socket.IO Handlers
  // -------------------------------------------------------------
  function onTaskCreatedSocket(task) {
    if (!currentProject || task.project !== currentProject._id) return;
    if (!currentTasks.some(t => t._id === task._id)) {
      currentTasks.push(task);
      renderBoard();
      showToast(`New task added: "${task.title}"`, 'info');
    }
  }

  function onTaskMovedSocket(payload) {
    const { taskId, destCol, task } = payload;
    const existing = currentTasks.find(t => t._id === taskId);
    if (existing) {
      existing.columnId = destCol;
      renderBoard();
    } else if (currentProject && task && task.project === currentProject._id) {
      currentTasks.push(task);
      renderBoard();
    }

    if (currentOpenTaskId === taskId) {
      document.getElementById('modalColumnBadge').textContent = formatColumnTitle(destCol);
      document.getElementById('modalTaskColumn').value = destCol;
    }
  }

  function onTaskUpdatedSocket(task) {
    if (!currentProject || task.project !== currentProject._id) return;
    const idx = currentTasks.findIndex(t => t._id === task._id);
    if (idx !== -1) {
      currentTasks[idx] = task;
      renderBoard();
    }
    if (currentOpenTaskId === task._id) {
      renderModalChecklist(task);
      document.getElementById('modalTaskTitle').value = task.title;
      document.getElementById('modalTaskDesc').value = task.description || '';
      document.getElementById('modalTaskPriority').value = task.priority || 'medium';
      document.getElementById('modalColumnBadge').textContent = formatColumnTitle(task.columnId);
    }
  }

  function onTaskDeletedSocket(payload) {
    currentTasks = currentTasks.filter(t => t._id !== payload.taskId);
    renderBoard();
    if (currentOpenTaskId === payload.taskId) {
      closeTaskDetailModal();
      showToast('This task was removed by a team member', 'warning');
    }
  }

  function onCommentAddedSocket(payload) {
    const { taskId, comment } = payload;
    const task = currentTasks.find(t => t._id === taskId);
    if (task) {
      task.commentCount = (task.commentCount || 0) + 1;
      renderBoard();
    }
    if (currentOpenTaskId === taskId) {
      loadTaskComments(taskId);
    }
  }

  function onNotificationReceivedSocket(notif) {
    notifications.unshift(notif);
    updateNotificationBadge();
    showToast(notif.message, 'info');
  }

  function onProjectUpdatedSocket(project) {
    if (currentProject && currentProject._id === project._id) {
      currentProject = project;
      updateProjectHeroUI();
    }
  }

  // -------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------
  async function loadNotifications() {
    if (!currentUser) return;
    try {
      const res = await API.notifications.getAll();
      notifications = res.notifications || [];
      updateNotificationBadge();
      renderNotificationList();
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  }

  function updateNotificationBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const unread = notifications.filter(n => !n.read).length;
    if (unread > 0) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  function toggleNotificationsDropdown() {
    const dd = document.getElementById('notifDropdown');
    if (!dd) return;
    const isHidden = dd.style.display === 'none';
    dd.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      renderNotificationList();
    }
  }

  function renderNotificationList() {
    const list = document.getElementById('notificationList');
    if (!list) return;

    if (notifications.length === 0) {
      list.innerHTML = '<div class="empty-notif">No notifications yet</div>';
      return;
    }

    list.innerHTML = notifications.map(n => {
      const time = new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="notif-item ${n.read ? '' : 'unread'}" onclick="app.markNotificationRead('${n._id}')">
          <i class="bi ${getNotifIcon(n.type)}" style="font-size: 1.1rem; color: var(--primary);"></i>
          <div style="flex: 1;">
            <div>${escapeHtml(n.message)}</div>
            <div class="notif-time">${time}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getNotifIcon(type) {
    switch (type) {
      case 'task_assigned': return 'bi-person-check-fill';
      case 'comment_added': return 'bi-chat-left-dots-fill';
      case 'project_invite': return 'bi-folder-plus';
      default: return 'bi-bell-fill';
    }
  }

  async function markNotificationRead(id) {
    try {
      await API.notifications.markRead(id);
      const n = notifications.find(x => x._id === id);
      if (n) n.read = true;
      updateNotificationBadge();
      renderNotificationList();
    } catch (err) {
      console.error(err);
    }
  }

  async function markAllNotificationsRead() {
    try {
      await API.notifications.markAllRead();
      notifications.forEach(n => n.read = true);
      updateNotificationBadge();
      renderNotificationList();
      showToast('All notifications marked as read', 'info');
    } catch (err) {
      console.error(err);
    }
  }

  // -------------------------------------------------------------
  // Helpers & Toasts
  // -------------------------------------------------------------
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconMap = {
      success: 'bi-check-circle-fill',
      warning: 'bi-exclamation-triangle-fill',
      error: 'bi-x-circle-fill',
      info: 'bi-info-circle-fill'
    };

    toast.innerHTML = `
      <i class="bi ${iconMap[type] || 'bi-info-circle-fill'}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toast-slide-in 0.2s reverse forwards';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  function formatColumnTitle(colId) {
    switch (colId) {
      case 'todo': return 'To Do';
      case 'in_progress': return 'In Progress';
      case 'review': return 'In Review';
      case 'done': return 'Completed';
      default: return colId;
    }
  }

  function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderEmptyBoard() {
    const dropzone = document.getElementById('dropzone-todo');
    if (dropzone) {
      dropzone.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
          <i class="bi bi-folder-plus" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
          No project selected.<br />
          <button class="btn btn-sm btn-primary mt-2" onclick="app.openNewProjectModal()">Create First Project</button>
        </div>
      `;
    }
  }

  // Global click to close popovers
  window.addEventListener('click', (e) => {
    const notifBtn = document.getElementById('notifBellBtn');
    const notifDd = document.getElementById('notifDropdown');
    if (notifDd && notifBtn && !notifBtn.contains(e.target) && !notifDd.contains(e.target)) {
      notifDd.style.display = 'none';
    }

    const userDd = document.getElementById('userDropdownMenu');
    if (userDd && !e.target.closest('.user-profile-menu-container')) {
      userDd.style.display = 'none';
    }
  });

  // Start app on DOMContentLoaded
  window.addEventListener('DOMContentLoaded', init);

  // Public Exports
  return {
    init,
    toggleTheme,
    toggleUserMenu,
    quickDemoLogin,
    handleLogin,
    handleRegister,
    logout,
    openAuthModal,
    closeAuthModal,
    switchAuthTab,
    switchProject,
    openNewProjectModal,
    closeNewProjectModal,
    handleCreateProject,
    openInviteModal,
    closeInviteModal,
    handleAddMember,
    openNewTaskModal,
    closeNewTaskModal,
    handleCreateTask,
    openTaskDetailModal,
    closeTaskDetailModal,
    saveTaskDetailsDebounced,
    toggleChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    confirmDeleteCurrentTask,
    submitTaskComment,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    setPriorityFilter,
    setAssigneeFilter,
    filterTasks,
    clearSearch,
    toggleNotificationsDropdown,
    markNotificationRead,
    markAllNotificationsRead,
    onTaskCreatedSocket,
    onTaskMovedSocket,
    onTaskUpdatedSocket,
    onTaskDeletedSocket,
    onCommentAddedSocket,
    onNotificationReceivedSocket,
    onProjectUpdatedSocket
  };
})();
