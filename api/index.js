const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'env.') });

const app = express();

const { pool, testDatabaseConnection } = require('../config/database');
const { initContentDatabase } = require('../config/content-db');
const authRouter = require('./auth');
const otpRouter = require('./otp');
const { requireAuth, requireOwner, requireOwnerPage } = require('../middleware/auth');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.get('/', (req, res) => {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.sendFile(
      path.join(__dirname, '..', 'public', 'login.html')
    );
  }

  return res.sendFile(
    path.join(__dirname, '..', 'public', 'index.html')
  );
});

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
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRouter);
app.use('/api/otp', otpRouter);

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Photographer Karrar Karim API is running',
    version: '1.0.0'
  });
});


app.get('/api/user/profile', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        full_name,
        last_name,
        birth_date,
        country,
        phone,
        city,
        state,
        zip,
        id_type,
        id_name,
        id_number,
        id_image,
        profile_image,
        email,
        phone2,
        created_at,
        updated_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'بيانات المستخدم غير موجودة'
      });
    }

    return res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Get user profile error:', error);

    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب بيانات المستخدم'
    });
  }
});

app.put('/api/user/profile', requireAuth, async (req, res) => {
  try {
    const {
      fullName,
      lastName,
      birthDate,
      country,
      phone,
      city,
      state,
      zip,
      idType,
      idName,
      idNumber,
      idImage,
      profileImage,
      email,
      phone2
    } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET
        full_name = COALESCE(NULLIF($1, ''), full_name),
        last_name = $2,
        birth_date = $3,
        country = $4,
        phone = $5,
        city = $6,
        state = $7,
        zip = $8,
        id_type = $9,
        id_name = $10,
        id_number = $11,
        id_image = $12,
        profile_image = $13,
        email = COALESCE(NULLIF($14, ''), email),
        phone2 = $15,
        updated_at = NOW()
       WHERE id = $16
       RETURNING
        id,
        full_name,
        last_name,
        birth_date,
        country,
        phone,
        city,
        state,
        zip,
        id_type,
        id_name,
        id_number,
        id_image,
        profile_image,
        email,
        phone2,
        created_at,
        updated_at`,
      [
        fullName?.trim() || '',
        lastName?.trim() || null,
        birthDate || null,
        country?.trim() || null,
        phone?.trim() || null,
        city?.trim() || null,
        state?.trim() || null,
        zip?.trim() || null,
        idType?.trim() || null,
        idName?.trim() || null,
        idNumber?.trim() || null,
        idImage?.trim() || null,
        profileImage?.trim() || null,
        email?.trim().toLowerCase() || '',
        phone2?.trim() || null,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    return res.json({
      success: true,
      message: 'تم حفظ بيانات المستخدم بنجاح',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Update user profile error:', error);

    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حفظ بيانات المستخدم'
    });
  }
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
