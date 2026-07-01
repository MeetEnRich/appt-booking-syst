const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbQuery } = require('../db');
const { JWT_SECRET } = require('../middleware');

// POST /api/auth/register (Visitor only)
router.post('/register', async (req, res) => {
  const { full_name, email, password, matric_staff_id } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Please provide full name, email, and password.' });
  }

  try {
    // Check if email already exists
    const existingUser = await dbQuery.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user as visitor
    await dbQuery.run(
      `INSERT INTO users (full_name, email, password_hash, role, matric_staff_id) VALUES (?, ?, ?, ?, ?)`,
      [full_name.trim(), email.toLowerCase().trim(), hashedPassword, 'visitor', matric_staff_id ? matric_staff_id.trim() : null]
    );

    res.status(201).json({ message: 'Registration successful! You can now log in.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide both email and password.' });
  }

  try {
    const user = await dbQuery.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        matric_staff_id: user.matric_staff_id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Set to true in production
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    });

    // Also return user and token in response for flex
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        matric_staff_id: user.matric_staff_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me (Check session)
router.get('/me', async (req, res) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers.cookie) {
    const cookieToken = req.headers.cookie
      .split('; ')
      .find(row => row.startsWith('token='));
    if (cookieToken) {
      token = cookieToken.split('=')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'No active session' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    res.json({ user: verified });
  } catch (err) {
    res.status(401).json({ error: 'Invalid session' });
  }
});

module.exports = router;
