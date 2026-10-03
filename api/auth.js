const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../config/database');

const router = express.Router();

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

function createAuthToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
}

function setAuthCookie(res, user) {
  const token = createAuthToken(user);

  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

/* التسجيل العادي */
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'
      });
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'البريد الإلكتروني مستخدم مسبقاً'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
        (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, created_at`,
      [
        fullName.trim(),
        normalizedEmail,
        passwordHash
      ]
    );

    const user = result.rows[0];

    setAuthCookie(res, user);

    return res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح',
      user
    });

  } catch (error) {
    console.error('❌ Registration error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء الحساب'
    });
  }
});

/* تسجيل الدخول العادي */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT
        id,
        full_name,
        email,
        password_hash,
        created_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    const user = result.rows[0];

    const passwordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    setAuthCookie(res, user);

    return res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تسجيل الدخول'
    });
  }
});

/* بدء تسجيل الدخول بواسطة Google */
router.get('/google', (req, res) => {
  const authUrl = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid',
      'email',
      'profile'
    ],
    prompt: 'select_account'
  });

  res.redirect(authUrl);
});

/* عودة Google بعد تسجيل الدخول */
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect('/login.html?google=error');
    }

    const { tokens } = await googleClient.getToken(code);

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      return res.redirect('/login.html?google=error');
    }

    const googleId = payload.sub;
    const email = payload.email.trim().toLowerCase();
    const fullName = (
      payload.name ||
      payload.email.split('@')[0]
    ).trim();

    let result = await pool.query(
      `SELECT id, full_name, email, created_at
       FROM users
       WHERE google_id = $1
       LIMIT 1`,
      [googleId]
    );

    let user;

    if (result.rows.length > 0) {
      user = result.rows[0];
    } else {
      result = await pool.query(
        `SELECT id, full_name, email, password_hash, created_at
         FROM users
         WHERE email = $1
         LIMIT 1`,
        [email]
      );

      if (result.rows.length > 0) {
        user = result.rows[0];

        await pool.query(
          `UPDATE users
           SET google_id = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [googleId, user.id]
        );
      } else {
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 12);

        const newUser = await pool.query(
          `INSERT INTO users
            (full_name, email, password_hash, google_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id, full_name, email, created_at`,
          [
            fullName,
            email,
            passwordHash,
            googleId
          ]
        );

        user = newUser.rows[0];
      }
    }

    setAuthCookie(res, user);

    return res.redirect('/dashboard');

  } catch (error) {
    console.error('❌ Google OAuth error:', error.message);

    return res.redirect('/login.html?google=error');
  }
});

/* تسجيل الخروج */
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });

  return res.json({
    success: true,
    message: 'تم تسجيل الخروج'
  });
});

module.exports = router;
