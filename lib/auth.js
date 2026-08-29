// lib/auth.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// لازم تحط JWT_SECRET في Environment Variables (قيمة عشوائية طويلة وسرية)
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY_DAYS = 30;

function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

function normalizePhone(phone) {
  // بيشيل المسافات والرموز، ويسيب الأرقام بس (ومسافة لعلامة + الدولية لو موجودة)
  if (!phone) return '';
  return phone.toString().trim().replace(/[^\d+]/g, '');
}

function generateToken(userId) {
  // بنضيف jti (رقم عشوائي فريد) عشان لو المستخدم عمل تسجيل دخول مرتين في نفس الثانية بالظبط،
  // يفضل كل token مختلف عن التاني وميحصلش تعارض في قاعدة البيانات
  const jti = crypto.randomBytes(16).toString('hex');
  return jwt.sign({ userId, jti }, JWT_SECRET, { expiresIn: `${TOKEN_EXPIRY_DAYS}d` });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function hashToken(token) {
  // بنخزن hash بتاع التوكن في الداتابيز مش التوكن نفسه، عشان لو حصل تسريب للداتابيز التوكنز متبقاش صالحة للاستخدام مباشرة
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  hashPassword,
  comparePassword,
  normalizePhone,
  generateToken,
  verifyToken,
  hashToken,
  TOKEN_EXPIRY_DAYS,
};
