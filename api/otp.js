const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'env.') });

const { pool } = require('../config/database');
const router = express.Router();

let tableReady;

async function ensureTable() {
  if (!tableReady) {
    tableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        email VARCHAR(255) PRIMARY KEY,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        registration_token_hash TEXT,
        verified_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch(err => {
      tableReady = null;
      throw err;
    });
  }
  await tableReady;
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length &&
    crypto.timingSafeEqual(left, right);
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function makeTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('إعدادات البريد الإلكتروني غير مكتملة على الخادم');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

/* إرسال رمز التحقق */
router.post('/send', async (req, res) => {
  try {
    await ensureTable();

    const email = normalizeEmail(req.body.email);
    const username = String(req.body.username || '').trim();

    if (!validEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'أدخل بريداً إلكترونياً صحيحاً'
      });
    }

    const existing = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        success: false,
        message: 'هذا البريد الإلكتروني مسجل مسبقاً'
      });
    }

    const recent = await pool.query(
      `SELECT created_at FROM email_verifications
       WHERE email = $1 AND created_at > NOW() - INTERVAL '60 seconds'`,
      [email]
    );

    if (recent.rows.length) {
      return res.status(429).json({
        success: false,
        message: 'انتظر دقيقة قبل طلب رمز جديد'
      });
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');

    await pool.query(
      `INSERT INTO email_verifications
       (email, code_hash, expires_at, attempts, registration_token_hash,
        verified_until, created_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 0, NULL, NULL, NOW())
       ON CONFLICT (email) DO UPDATE SET
         code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at,
         attempts = 0,
         registration_token_hash = NULL,
         verified_until = NULL,
         created_at = NOW()`,
      [email, hash(code)]
    );

    const transporter = makeTransport();

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'رمز التحقق - Photographer Karrar Karim',
      text:
        `مرحباً${username ? ' ' + username : ''}،\n\n` +
        `رمز التحقق الخاص بك هو: ${code}\n` +
        `تنتهي صلاحية الرمز خلال 10 دقائق.\n` +
        `إذا لم تطلب هذا الرمز، فتجاهل هذه الرسالة.`,
      html:
        `<div dir="rtl" style="font-family:Arial,sans-serif">` +
        `<h2>تأكيد البريد الإلكتروني</h2>` +
        `<p>مرحباً ${username.replace(/[&<>"]/g, '')}،</p>` +
        `<p>رمز التحقق الخاص بك:</p>` +
        `<div style="font-size:30px;font-weight:bold;letter-spacing:8px">` +
        `${code}</div><p>الرمز صالح لمدة 10 دقائق.</p></div>`
    });

    return res.json({
      success: true,
      message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني'
    });
  } catch (error) {
    console.error('OTP send error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message.includes('إعدادات البريد')
        ? error.message
        : 'تعذر إرسال رمز التحقق. تأكد من إعدادات البريد وحاول لاحقاً'
    });
  }
});

/* التحقق من الرمز وإصدار تصريح تسجيل مؤقت */
router.post('/verify', async (req, res) => {
  try {
    await ensureTable();

    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || '').trim();

    if (!validEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'أدخل البريد ورمز التحقق المكوّن من 6 أرقام'
      });
    }

    const result = await pool.query(
      `SELECT code_hash, expires_at, attempts
       FROM email_verifications WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (!result.rows.length) {
      return res.status(400).json({
        success: false,
        message: 'اطلب رمز تحقق جديداً أولاً'
      });
    }

    const record = result.rows[0];

    if (new Date(record.expires_at).getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'انتهت صلاحية الرمز. اطلب رمزاً جديداً'
      });
    }

    if (record.attempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'تجاوزت عدد المحاولات. اطلب رمزاً جديداً'
      });
    }

    if (!safeEqual(hash(code), record.code_hash)) {
      await pool.query(
        `UPDATE email_verifications
         SET attempts = attempts + 1 WHERE email = $1`,
        [email]
      );

      return res.status(400).json({
        success: false,
        message: 'رمز التحقق غير صحيح'
      });
    }

    const registrationToken = crypto.randomBytes(32).toString('hex');

    await pool.query(
      `UPDATE email_verifications
       SET registration_token_hash = $2,
           verified_until = NOW() + INTERVAL '15 minutes'
       WHERE email = $1`,
      [email, hash(registrationToken)]
    );

    return res.json({
      success: true,
      registrationToken,
      message: 'تم التحقق من البريد الإلكتروني'
    });
  } catch (error) {
    console.error('OTP verify error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء التحقق. حاول مرة أخرى'
    });
  }
});

/* إنشاء الحساب وحفظ الملف الشخصي بعد نجاح التحقق فقط */
router.post('/complete', async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureTable();

    const body = req.body || {};
    const form = body.formData || {};
    const email = normalizeEmail(form.email);
    const registrationToken = String(body.registrationToken || '');

    if (!validEmail(email) || registrationToken.length < 32) {
      return res.status(400).json({
        success: false,
        message: 'بيانات التحقق غير مكتملة. أعد عملية التحقق'
      });
    }

    const verification = await client.query(
      `SELECT registration_token_hash, verified_until
       FROM email_verifications
       WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (!verification.rows.length ||
        !verification.rows[0].registration_token_hash ||
        !verification.rows[0].verified_until ||
        new Date(verification.rows[0].verified_until).getTime() <= Date.now() ||
        !safeEqual(
          hash(registrationToken),
          verification.rows[0].registration_token_hash
        )) {
      return res.status(403).json({
        success: false,
        message: 'انتهت صلاحية التحقق أو أن رمز التسجيل غير صالح. تحقق من بريدك مجدداً'
      });
    }

    const fullName = String(form.fullName || '').trim();
    const lastName = String(form.lastName || '').trim();
    const password = String(form.password || '');
    const birthDate = form.birthYear && form.birthMonth && form.birthDay
      ? `${form.birthYear}-${String(form.birthMonth).padStart(2, '0')}-${String(form.birthDay).padStart(2, '0')}`
      : null;

    if (!fullName || !lastName || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'الاسم واللقب وكلمة المرور الصحيحة مطلوبة'
      });
    }

    const profileImage = typeof form.profileImage === 'string'
      ? form.profileImage : null;
    const idImage = typeof form.idImage === 'string'
      ? form.idImage
      : (typeof form.imageLink === 'string' ? form.imageLink : null);

    await client.query('BEGIN');

    const duplicate = await client.query(
      'SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );

    if (duplicate.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'هذا البريد الإلكتروني مسجل مسبقاً'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const inserted = await client.query(
      `INSERT INTO users (
        full_name, last_name, email, password_hash, birth_date,
        country, phone, city, state, zip, id_type, id_name,
        id_number, id_image, profile_image, phone2
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
      )
      RETURNING id, full_name, email, created_at`,
      [
        fullName, lastName, email, passwordHash, birthDate,
        form.country || null, form.phone || null, form.city || null,
        form.state || null, form.zip || null, form.idType || null,
        form.idName || null, form.idNumber || null, idImage,
        profileImage, form.phone2 || null
      ]
    );

    await client.query(
      'DELETE FROM email_verifications WHERE email = $1',
      [email]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب وحفظ بياناتك بنجاح',
      user: inserted.rows[0]
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Registration completion error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'تعذر حفظ الحساب. حاول مرة أخرى'
    });
  } finally {
    client.release();
  }
});

module.exports = router;
