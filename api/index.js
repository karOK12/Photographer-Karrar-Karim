const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'env.') });

const app = express();

const { pool, testDatabaseConnection } = require('../config/database');
const { initContentDatabase } = require('../config/content-db');
const authRouter = require('./auth');
const { requireOwner, requireOwnerPage } = require('../middleware/auth');

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

app.post('/api/posts', requireOwner, async (req, res) => {
  try {
    const {
      title,
      section,
      subsection,
      content
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'عنوان المنشور مطلوب'
      });
    }

    if (!section || !section.trim()) {
      return res.status(400).json({
        success: false,
        message: 'القسم مطلوب'
      });
    }

    const allowedSections = [
      'studio',
      'poetry',
      'theatre',
      'events',
      'festivals',
      'articles'
    ];

    const cleanSection = section.trim();

    if (!allowedSections.includes(cleanSection)) {
      return res.status(400).json({
        success: false,
        message: 'القسم غير صالح'
      });
    }

    const result = await pool.query(
      `INSERT INTO posts
        (user_id, section, subsection, content, title, is_published)
       VALUES
        ($1, $2, $3, $4, $5, true)
       RETURNING
        id,
        user_id,
        section,
        subsection,
        content,
        title,
        is_published,
        created_at,
        updated_at`,
      [
        req.user.id,
        cleanSection,
        subsection?.trim() || null,
        content?.trim() || null,
        title.trim()
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'تم نشر المنشور بنجاح',
      post: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Create post error:', error);

    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء نشر المنشور'
    });
  }
});

testDatabaseConnection().catch((error) => {
  console.error('❌ Neon connection failed:', error.message);
});

initContentDatabase().catch((error) => {
  console.error('❌ Content database initialization failed:', error.message);
});

module.exports = app;
