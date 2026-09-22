const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'codealpha_task3_project_manager_jwt_secret_2026',
    { expiresIn: '7d' }
  );
};

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password, roleTitle, avatar } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, username, email, and password'
      });
    }

    // Check existing
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase()
          ? 'Email address is already registered'
          : 'Username is already taken'
      });
    }

    const user = await User.create({
      name,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      roleTitle: roleTitle || 'Team Member',
      avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server registration error' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body; // login can be email or username

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email/username and password'
      });
    }

    const normalizedLogin = login.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: normalizedLogin }, { username: normalizedLogin }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password incorrect.'
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server login error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', auth, async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// @route   GET /api/auth/users
// @desc    Get all users for member invite & task assignment dropdowns
router.get('/users', auth, async (req, res) => {
  try {
    const users = await User.find({}).select('name username email avatar roleTitle');
    res.json({
      success: true,
      users
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
