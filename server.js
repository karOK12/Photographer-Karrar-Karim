const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: 'env.' });

const app = express();
const PORT = process.env.PORT || 3000;

const { testDatabaseConnection } = require('./config/database');
const authRouter = require('./api/auth');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/dashboard', (req, res) => {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.redirect('/login.html');
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);

    return res.sendFile(
      path.join(__dirname, 'public', 'dashboard', 'index.html')
    );
  } catch (error) {
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    return res.redirect('/login.html');
  }
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Authentication
app.use('/api/auth', authRouter);

// Basic API
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Photographer Karrar Karim API is running',
    version: '1.0.0'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'online'
  });
});

// Local server
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log('📸 Photographer Karrar Karim');
    console.log(`🚀 Server running on port ${PORT}`);

    try {
      await testDatabaseConnection();
    } catch (error) {
      console.error('❌ Neon connection failed:', error.message);
    }
  });
}

module.exports = app;
