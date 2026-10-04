const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'env.') });

const app = express();

const { testDatabaseConnection } = require('../config/database');
const authRouter = require('./auth');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, '..')));

app.get('/dashboard', (req, res) => {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.redirect('/login.html');
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);

    return res.sendFile(
      path.join(__dirname, '..', 'public', 'dashboard', 'index.html')
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
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRouter);

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Photographer Karrar Karim API is running',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'online'
  });
});

testDatabaseConnection().catch((error) => {
  console.error('❌ Neon connection failed:', error.message);
});

module.exports = app;
