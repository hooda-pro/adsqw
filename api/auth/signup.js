// api/auth/signup.js
// POST { phone, password, name }
const { sql } = require('../../lib/db');
const { hashPassword, generateToken, hashToken, TOKEN_EXPIRY_DAYS } = require('../../lib/auth');
const { canonicalPhone, phoneVariants, phoneError } = require('../../lib/phone');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone: rawPhone, password, name } = req.body || {};

    if (!rawPhone || !password || !name) {
      return res.status(400).json({ error: 'الرقم والباسورد والاسم مطلوبين' });
    }

    // رقم قياسي واحد (canonical) — نفس المنطق اللي في المتصفح بالظبط
    const phone = canonicalPhone(rawPhone);

    if (!phone) {
      return res.status(400).json({ error: phoneError(rawPhone) || 'رقم الهاتف غير صحيح' });
    }

    if (String(name).trim().length < 2) {
      return res.status(400).json({ error: 'الاسم لازم يكون حرفين على الأقل' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'كلمة السر لازم تكون 6 أحرف على الأقل' });
    }

    // تأكد إن الرقم مش مسجل قبل كده — بأي صيغة قديمة كان متخزّن بيها
    const existing = await sql`SELECT id FROM users WHERE phone = ANY(${phoneVariants(rawPhone)})`;
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'الرقم ده مسجل بالفعل' });
    }

    const passwordHash = await hashPassword(password);

    const result = await sql`
      INSERT INTO users (phone, password_hash, name)
      VALUES (${phone}, ${passwordHash}, ${String(name).trim()})
      RETURNING id, phone, name, avatar_url, status_text, is_verified, is_official, created_at
    `;

    const user = result.rows[0];
    const token = generateToken(user.id);
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await sql`
      INSERT INTO sessions (user_id, token_hash, device_info, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${req.headers['user-agent'] || 'unknown'}, ${expiresAt.toISOString()})
    `;

    return res.status(201).json({ user, token });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'حصل خطأ في السيرفر، حاول تاني' });
  }
};
