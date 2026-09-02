// api/users/change-phone.js
// POST { new_phone, password }
// بيغير رقم الموبايل بعد التحقق من كلمة السر.
const { sql } = require('../../lib/db');
const { getUserFromRequest } = require('../../lib/session');
const { comparePassword } = require('../../lib/auth');
const { canonicalPhone, phoneVariants, phoneError } = require('../../lib/phone');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'الجلسة منتهية، سجل دخول تاني' });
    }

    const { new_phone, password } = req.body || {};

    if (!new_phone || !password) {
      return res.status(400).json({ error: 'الرقم الجديد وكلمة السر مطلوبين' });
    }

    const phone = canonicalPhone(new_phone);
    if (!phone) {
      return res.status(400).json({ error: phoneError(new_phone) || 'رقم الهاتف غير صحيح' });
    }

    // تأكد إن الرقم الجديد مش مستخدم من حد تاني
    const existing = await sql`SELECT id FROM users WHERE phone = ANY(${phoneVariants(new_phone)}) AND id != ${user.id}`;
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'الرقم ده مسجل بحساب تاني' });
    }

    // تحقق من كلمة السر
    const passRow = await sql`SELECT password_hash FROM users WHERE id = ${user.id}`;
    const ok = await comparePassword(password, passRow.rows[0].password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'كلمة السر غلط' });
    }

    const result = await sql`
      UPDATE users
      SET phone = ${phone}, updated_at = now()
      WHERE id = ${user.id}
      RETURNING id, phone, name, avatar_url, status_text, is_verified, is_official
    `;

    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Change phone error:', err);
    return res.status(500).json({ error: 'حصل خطأ في السيرفر، حاول تاني' });
  }
};