// api/auth/login.js
// POST { phone, password }
const { sql } = require('../../lib/db');
const { comparePassword, normalizePhone, generateToken, hashToken, TOKEN_EXPIRY_DAYS } = require('../../lib/auth');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone: rawPhone, password } = req.body || {};

    if (!rawPhone || !password) {
      return res.status(400).json({ error: 'الرقم والباسورد مطلوبين' });
    }

    const phone = normalizePhone(rawPhone);

    const result = await sql`SELECT * FROM users WHERE phone = ${phone}`;
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'الرقم أو كلمة السر غلط' });
    }

    if (user.banned) {
      return res.status(403).json({ error: 'الحساب ده محظور' });
    }

    // تحقق من القفل بسبب محاولات فاشلة كتير
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(429).json({ error: `الحساب مقفول مؤقتاً، حاول تاني بعد ${minutesLeft} دقيقة` });
    }

    const passwordOk = await comparePassword(password, user.password_hash);

    if (!passwordOk) {
      const attempts = user.failed_login_attempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
        : null;

      await sql`
        UPDATE users
        SET failed_login_attempts = ${attempts}, locked_until = ${lockedUntil}
        WHERE id = ${user.id}
      `;

      if (shouldLock) {
        return res.status(429).json({ error: `محاولات كتير غلط، الحساب اتقفل ${LOCK_MINUTES} دقيقة` });
      }
      return res.status(401).json({ error: 'الرقم أو كلمة السر غلط' });
    }

    // تسجيل دخول ناجح: تصفير المحاولات الفاشلة
    await sql`
      UPDATE users
      SET failed_login_attempts = 0, locked_until = NULL, last_seen_at = now()
      WHERE id = ${user.id}
    `;

    const token = generateToken(user.id);
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await sql`
      INSERT INTO sessions (user_id, token_hash, device_info, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${req.headers['user-agent'] || 'unknown'}, ${expiresAt.toISOString()})
    `;

    const { password_hash, ...safeUser } = user;

    return res.status(200).json({ user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'حصل خطأ في السيرفر، حاول تاني' });
  }
};
