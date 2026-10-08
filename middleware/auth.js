const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'لم يتم تسجيل الدخول'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      `SELECT id, full_name, email, role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'الحساب غير موجود'
      });
    }

    req.user = result.rows[0];

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'جلسة الدخول غير صالحة'
    });
  }
}

async function requireOwnerPage(req, res, next) {
  try {
    const token = req.cookies?.auth_token;

    if (!token) {
      return res.redirect('/login.html');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      `SELECT id, full_name, email, role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });
      return res.redirect('/login.html');
    }

    if (result.rows[0].role !== 'owner') {
      return res.status(403).send('ليس لديك صلاحية الوصول إلى لوحة التحكم');
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    return res.redirect('/login.html');
  }
}

async function requireOwner(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية الوصول إلى لوحة التحكم'
      });
    }

    next();
  });
}

module.exports = {
  requireAuth,
  requireOwner,
  requireOwnerPage
};
