const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');

const LOCAL_MONGODB_URI = 'mongodb://127.0.0.1:27017/INTERNSHIP_TASK3';

let activeDatabaseMode = 'unknown';

async function connectDB() {
  const primaryUri = process.env.MONGODB_URI;

  // 1. If MONGODB_URI is provided in .env, attempt connection to it (e.g. MongoDB Atlas)
  if (primaryUri) {
    try {
      console.log('🔄 Attempting to connect to configured MongoDB database...');
      
      const conn = await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 5000, // 5 second timeout for fast failover if IP is not whitelisted
      });

      activeDatabaseMode = primaryUri.includes('mongodb.net') ? 'MongoDB Atlas' : 'Cloud MongoDB';
      console.log(`✅ ${activeDatabaseMode} Connected: ${conn.connection.host}`);
      console.log(`📂 Active Database: ${conn.connection.name} (Cloud Mode)`);

      await autoSeedIfEmpty();
      return conn;
    } catch (atlasError) {
      console.warn('\n⚠️ -------------------------------------------------------------');
      console.warn('⚠️ Cloud MongoDB Connection Error:');
      console.warn(`⚠️ ${atlasError.message}`);
      console.warn('⚠️ (Atlas requires your current IP address to be whitelisted.)');
      console.warn('⚠️ -------------------------------------------------------------\n');
    }
  }

    // 2. Attempt automatic fallback to local MongoDB Server
    try {
      console.log('🔄 Attempting automatic fallback to local MongoDB (127.0.0.1:27017)...');
      
      const localConn = await mongoose.connect(LOCAL_MONGODB_URI, {
        serverSelectionTimeoutMS: 3000,
      });

      activeDatabaseMode = 'Local MongoDB (127.0.0.1:27017)';
      console.log(`✅ Connected to Local MongoDB Server: ${localConn.connection.host}`);
      console.log(`📂 Active Database: ${localConn.connection.name} (Local Offline Fallback Mode)`);
      console.log('💡 The application is now fully functional with local database persistence!');

      await autoSeedIfEmpty();
      return localConn;
    } catch (localError) {
      activeDatabaseMode = 'Disconnected';
      console.error('❌ Local MongoDB Fallback Error:', localError.message);
      console.log('⚠️ Running in offline/disconnected mode.');
    }
}

async function autoSeedIfEmpty() {
  try {
    const projectCount = await Project.countDocuments();
    if (projectCount === 0) {
      console.log('🌱 No projects found. Starting initial database seeding for Task 3...');
      const seedFilePath = path.join(__dirname, '..', 'data', 'seedData.json');
      if (fs.existsSync(seedFilePath)) {
        const seedData = JSON.parse(fs.readFileSync(seedFilePath, 'utf-8'));
        
        // 1. Create or Find Users
        const createdUsersMap = {};
        for (const u of seedData.users) {
          let user = await User.findOne({ username: u.username });
          if (!user) {
            user = await User.create({
              name: u.name,
              username: u.username,
              email: u.email,
              password: u.password,
              avatar: u.avatar,
              roleTitle: u.roleTitle,
              bio: u.bio
            });
          }
          createdUsersMap[u.username] = user;
        }

        // 2. Create Projects & Tasks
        for (const p of seedData.projects) {
          const owner = createdUsersMap[p.ownerUsername];
          if (!owner) continue;

          // Build members array
          const members = [{ user: owner._id, role: 'owner' }];
          if (Array.isArray(p.memberUsernames)) {
            for (const uname of p.memberUsernames) {
              const mUser = createdUsersMap[uname];
              if (mUser && mUser._id.toString() !== owner._id.toString()) {
                members.push({ user: mUser._id, role: 'member' });
              }
            }
          }

          const project = await Project.create({
            name: p.name,
            description: p.description,
            category: p.category,
            color: p.color,
            owner: owner._id,
            members: members
          });

          // Create Tasks for this project
          if (Array.isArray(p.tasks)) {
            let taskOrder = 0;
            for (const t of p.tasks) {
              const assignees = [];
              if (Array.isArray(t.assigneeUsernames)) {
                for (const aname of t.assigneeUsernames) {
                  if (createdUsersMap[aname]) {
                    assignees.push(createdUsersMap[aname]._id);
                  }
                }
              }

              const task = await Task.create({
                title: t.title,
                description: t.description,
                project: project._id,
                columnId: t.columnId || 'todo',
                order: taskOrder++,
                priority: t.priority || 'medium',
                dueDate: new Date(Date.now() + 86400000 * Math.floor(Math.random() * 10 + 2)),
                assignees: assignees,
                labels: t.labels || [],
                checklist: t.checklist || [],
                createdBy: owner._id
              });

              // Add comments
              if (Array.isArray(t.comments)) {
                for (const c of t.comments) {
                  const author = createdUsersMap[c.authorUsername] || owner;
                  await Comment.create({
                    task: task._id,
                    project: project._id,
                    user: author._id,
                    text: c.text
                  });
                }
              }
            }
          }

          // Create a welcome notification for members
          for (const m of members) {
            await Notification.create({
              recipient: m.user,
              sender: owner._id,
              project: project._id,
              type: 'project_invite',
              message: `Welcome to project "${project.name}"!`
            });
          }
        }

        console.log(`🎉 Database seeding completed successfully! Seeded ${seedData.users.length} users and ${seedData.projects.length} projects.`);
      }
    } else {
      console.log(`📦 Database already has ${projectCount} project(s) ready.`);
    }
  } catch (error) {
    console.error('⚠️ Seeding error:', error.message);
  }
}

function getDatabaseStatus() {
  return {
    mode: activeDatabaseMode,
    isConnected: mongoose.connection.readyState === 1,
    databaseName: mongoose.connection.name || 'None'
  };
}

module.exports = {
  connectDB,
  autoSeedIfEmpty,
  getDatabaseStatus
};
