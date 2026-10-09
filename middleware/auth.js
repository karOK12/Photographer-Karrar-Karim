const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

async function getUser(id) {
  const result = await pool.query(
    `SELECT id, full_name, email, role, can_publish
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  return result.rows[0] || null;
}

function clearAuthCookie(res) {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
}

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
    const user = await getUser(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'الحساب غير موجود'
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'جلسة الدخول غير صالحة'
    });
  }
}

async function requirePageAccess(req, res, next, allowed) {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.redirect('/login.html');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUser(decoded.id);

    if (!user) {
      clearAuthCookie(res);
      return res.redirect('/login.html');
    }

    if (!allowed(user)) {
      return res.status(403).send(
        'ليس لديك صلاحية الوصول إلى هذه الصفحة'
      );
    }

    req.user = user;
    return next();
  } catch (error) {
    clearAuthCookie(res);
    return res.redirect('/login.html');
  }
}

function requireAuthPage(req, res, next) {
  return requirePageAccess(req, res, next, () => true);
}

function requireOwnerPage(req, res, next) {
  return requirePageAccess(
    req,
    res,
    next,
    user => user.role === 'owner'
  );
}

function requirePublisherPage(req, res, next) {
  return requirePageAccess(
    req,
    res,
    next,
    user => user.role === 'owner' || user.can_publish === true
  );
}

function requireOwner(req, res, next) {
  return requireAuth(req, res, () => {
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية إدارة لوحة التحكم'
      });
    }

    return next();
  });
}

function requirePublisher(req, res, next) {
  return requireAuth(req, res, () => {
    if (
      req.user.role !== 'owner' &&
      req.user.can_publish !== true
    ) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية النشر'
      });
    }

    return next();
  });
}

module.exports = {
  requireAuth,
  requireOwner,
  requirePublisher,
  requireAuthPage,
  requireOwnerPage,
  requirePublisherPage
};
