const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'env.') });

const app = express();

const { testDatabaseConnection } = require('../config/database');
const { initContentDatabase } = require('../config/content-db');
const authRouter = require('./auth');
const { requireOwnerPage } = require('../middleware/auth');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.get('/dashboard', requireOwnerPage, (req, res) => {
  return res.sendFile(
    path.join(__dirname, '..', 'public', 'dashboard', 'index.html')
  );
});

app.use(
  '/dashboard',
  requireOwnerPage,
  express.static(path.join(__dirname, '..', 'public', 'dashboard'))
);
app.use(express.static(path.join(__dirname, '..')));

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

initContentDatabase().catch((error) => {
  console.error('❌ Content database initialization failed:', error.message);
});

module.exports = app;
