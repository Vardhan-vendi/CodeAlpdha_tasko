# CodeAlpdha_tasko — Collaborative Project Management Tool (Task 3)

A modern, full-stack, real-time collaborative project management platform built for **CodeAlpha Internship Task 3**.

---

## 🌟 Features Overview

### 1. Group Projects & Team Collaboration
- **Create & Manage Projects**: Group projects with custom titles, descriptions, categories, and theme colors.
- **Role-Based Membership**: Team roles (`Owner`, `Admin`, `Member`) for access control and delegation.
- **Collaborator Invitations**: Seamlessly invite registered team members to projects.

### 2. Interactive Kanban Boards & Task Cards
- **Dynamic Columns**: Standard workflow stages: **To Do**, **In Progress**, **In Review**, and **Completed** with live counter badges.
- **Native HTML5 Drag & Drop**: Effortlessly drag task cards between columns with instant visual feedback, optimistic UI updates, and backend persistence.
- **Rich Task Attributes**:
  - Priority levels (`Urgent`, `High`, `Medium`, `Low`) with color indicators.
  - Due date tracking with automatic overdue alerts.
  - Interactive checklists & subtasks with visual completion progress bars.
  - Assignee assignments with user profile avatar stacks.
  - Tagging and categorizing with colored label pills.

### 3. Task Communication & Real-Time Comments
- **Activity & Comment Stream**: Real-time comment threads attached to every task card.
- **Instant Messaging**: Discuss progress, post status updates, and coordinate with team members directly on the task.

### 4. Real-Time WebSockets & Notifications (Bonus Requirement ⭐)
- **Powered by Socket.IO**:
  - Room-based real-time broadcasting (`project:<id>` and `user:<id>`).
  - Board cards move, update, and appear across all connected team screens instantly without page reload.
- **In-App Notification Center**:
  - Dropdown bell with unread counter badge.
  - Alerts for task assignments, moves, mentions, and comments with 1-click mark as read.

### 5. Authentication & Quick Demo Switcher
- **JWT & Password Hashing**: Secure token-based authentication using `jsonwebtoken` and `bcryptjs`.
- **Zero-Barrier 1-Click Demo Login**: Instantly switch between 4 realistic demo users (Alex Rivera - PM, Sarah Chen - Lead Dev, Marcus Johnson - Frontend, Elena Rostova - Designer) to test multi-user collaboration in real time.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend** | Node.js, Express.js, HTTP server |
| **Real-Time** | Socket.IO (WebSockets) |
| **Database** | MongoDB Atlas with Mongoose ODM (`INTERNSHIP_TASK3`) |
| **Authentication** | JSON Web Tokens (JWT), `bcryptjs` password hashing |
| **Frontend** | HTML5, CSS3 (Modern Glassmorphism & Custom Properties), JavaScript (ES6 Modules) |
| **Icons & Typography** | Bootstrap Icons, Google Fonts (Inter) |

---

## 📁 Directory Structure

```
Task3/
├── .env                         # Server environment variables & Atlas URI
├── .gitignore                   # Git ignore configurations
├── package.json                 # Dependencies & NPM scripts
├── README.md                    # Detailed documentation
├── server/
│   ├── config/
│   │   └── db.js                # MongoDB Atlas connection & auto-seeding
│   ├── data/
│   │   └── seedData.json        # Pre-seeded users, projects, tasks, comments
│   ├── middleware/
│   │   └── auth.js              # JWT Bearer token authentication guard
│   ├── models/
│   │   ├── User.js              # User schema
│   │   ├── Project.js           # Project schema with members & columns
│   │   ├── Task.js              # Task schema with priority, checklist, assignees
│   │   ├── Comment.js           # Comment schema
│   │   └── Notification.js      # In-app notification schema
│   ├── routes/
│   │   ├── authRoutes.js        # /api/auth
│   │   ├── projectRoutes.js     # /api/projects
│   │   ├── taskRoutes.js        # /api/tasks
│   │   ├── commentRoutes.js     # /api/comments
│   │   └── notificationRoutes.js# /api/notifications
│   ├── sockets/
│   │   └── socketHandler.js     # Socket.IO rooms & real-time events
│   ├── scripts/
│   │   └── seed.js              # Standalone DB seeding runner
│   └── server.js                # Server entry point (Express + Socket.IO)
└── public/
    ├── index.html               # Single-Page Application interface
    ├── css/
    │   └── styles.css           # Kanban board styles, Dark/Light modes
    └── js/
        ├── api.js               # REST API fetch client & JWT session
        ├── socket.js            # Socket.IO client setup
        └── app.js               # Main board UI controller & drag-drop logic
```

---

## 🚀 Getting Started

### 1. Installation

Navigate into the `Task3` directory:
```bash
cd Task3
npm install
```

### 2. Configuration (`.env`)

Create a `.env` file (or copy `.env.example`) and configure your MongoDB connection:
```env
PORT=5002
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/INTERNSHIP_TASK3?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key_here
```
*(If no `MONGODB_URI` is provided, the server automatically defaults to local MongoDB at `mongodb://127.0.0.1:27017/INTERNSHIP_TASK3`.)*

### 3. Run Server

Start the application:
```bash
npm start
```
Or with auto-reload:
```bash
npm run dev
```

Visit the app in your browser:
👉 **[http://localhost:5002](http://localhost:5002)**

---

## 👥 Pre-Seeded Demo Accounts

All accounts share the default password: `password123`

| Name | Username / Email | Role |
|---|---|---|
| **Alex Rivera** | `alex_rivera` / `alex@example.com` | Lead Product Manager |
| **Sarah Chen** | `sarah_chen` / `sarah@example.com` | Principal Full Stack Engineer |
| **Marcus Johnson** | `marcus_j` / `marcus@example.com` | Frontend Architect |
| **Elena Rostova** | `elena_r` / `elena@example.com` | Lead Product Designer |
| **David Kim** | `david_kim` / `david@example.com` | QA & Reliability Engineer |

> 💡 **Tip**: Use the **"Switch Active User"** menu in the top right or the 1-click chips in the Sign-In modal to test real-time collaboration between team members! Open two browser windows side-by-side to watch task cards move live!

---

## 🔌 API Endpoints Summary

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Create a new user account
- `POST /api/auth/login` — Sign in and receive JWT token
- `GET  /api/auth/me` — Retrieve current user profile
- `GET  /api/auth/users` — List registered users for member invitations

### Projects (`/api/projects`)
- `GET    /api/projects` — List all projects user has access to
- `GET    /api/projects/:id` — Get single project details & members
- `POST   /api/projects` — Create a new project
- `PUT    /api/projects/:id` — Update project metadata
- `DELETE /api/projects/:id` — Delete project (owner only)
- `POST   /api/projects/:id/members` — Add member to project

### Tasks (`/api/tasks`)
- `GET    /api/tasks?project=:id` — Get all tasks in project
- `GET    /api/tasks/:id` — Get single task with checklist and comment count
- `POST   /api/tasks` — Create task (broadcasts `task:created`)
- `PUT    /api/tasks/:id` — Update task details (broadcasts `task:updated`)
- `PATCH  /api/tasks/:id/move` — Move task across columns (broadcasts `task:moved`)
- `DELETE /api/tasks/:id` — Delete task (broadcasts `task:deleted`)

### Comments (`/api/comments`)
- `GET  /api/comments?task=:taskId` — List comments for task
- `POST /api/comments` — Post new comment (broadcasts `comment:added`)

### Notifications (`/api/notifications`)
- `GET /api/notifications` — Get user notifications & unread count
- `PUT /api/notifications/:id/read` — Mark single notification as read
- `PUT /api/notifications/read-all` — Mark all notifications as read
