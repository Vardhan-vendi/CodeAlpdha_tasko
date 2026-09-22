const http = require('http');

async function testApi() {
  console.log('🧪 Running Task 3 API Integration Verification...\n');

  // 1. Health check
  const health = await fetchJson('http://localhost:5002/api/health');
  console.log('✅ 1. Health Check:', health.status, '| DB:', health.database);

  // 2. Login
  const loginRes = await fetchJson('http://localhost:5002/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: 'alex_rivera', password: 'password123' })
  });
  console.log('✅ 2. Auth Login:', loginRes.user.name, `(${loginRes.user.roleTitle})`, '| Token issued');
  const token = loginRes.token;

  // 3. Get projects
  const projectsRes = await fetchJson('http://localhost:5002/api/projects', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ 3. Projects Count:', projectsRes.projects.length);
  const project = projectsRes.projects[0];
  console.log('   Active Project:', project.name, `[ID: ${project._id}]`);

  // 4. Get tasks
  const tasksRes = await fetchJson(`http://localhost:5002/api/tasks?project=${project._id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ 4. Tasks Count:', tasksRes.tasks.length);
  const sampleTask = tasksRes.tasks[0];
  console.log('   Sample Task:', sampleTask.title, `[Stage: ${sampleTask.columnId}, Priority: ${sampleTask.priority}]`);

  // 5. Create a new task
  const newTaskRes = await fetchJson('http://localhost:5002/api/tasks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: 'Automated Test Task Card',
      description: 'Verifying end-to-end task creation via test runner',
      project: project._id,
      columnId: 'todo',
      priority: 'urgent',
      labels: ['AutomatedTest']
    })
  });
  console.log('✅ 5. Created Task:', newTaskRes.task.title, `[ID: ${newTaskRes.task._id}]`);

  // 6. Move the task
  const moveRes = await fetchJson(`http://localhost:5002/api/tasks/${newTaskRes.task._id}/move`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ targetColumnId: 'in_progress' })
  });
  console.log('✅ 6. Moved Task to Stage:', moveRes.task.columnId);

  // 7. Post a comment on the task
  const commentRes = await fetchJson('http://localhost:5002/api/comments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      taskId: newTaskRes.task._id,
      text: 'Great work! Real-time synchronization is verified and working.'
    })
  });
  console.log('✅ 7. Posted Comment:', `"${commentRes.comment.text}" by ${commentRes.comment.user.name}`);

  // 8. Delete the test task
  const deleteRes = await fetchJson(`http://localhost:5002/api/tasks/${newTaskRes.task._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ 8. Cleaned up Test Task:', deleteRes.message);

  // 9. Get notifications
  const notifRes = await fetchJson('http://localhost:5002/api/notifications', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✅ 9. Notifications Checked:', notifRes.notifications.length, 'total');

  console.log('\n🎉 ALL 9 INTEGRATION VERIFICATIONS PASSED SUCCESSFULLY!');
}

async function fetchJson(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

testApi().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
