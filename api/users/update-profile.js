// api/users/update-profile.js
// PATCH { name?, status_text? }
// بيستخدم lib/session.js للتحقق من المستخدم
const { sql } = require('../../lib/db');
const { getUserFromRequest } = require('../../lib/session');

module.exports = async (req, res) => {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'الجلسة منتهية، سجل دخول تاني' });
    }

    const { name, status_text } = req.body || {};
    const updates = [];

    if (typeof name === 'string') {
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        return res.status(400).json({ error: 'الاسم لازم يكون حرفين على الأقل' });
      }
      updates.push(sql`name = ${trimmed}`);
    }

    if (typeof status_text === 'string') {
      const trimmed = status_text.trim().slice(0, 80);
      updates.push(sql`status_text = ${trimmed}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'مفيش حاجات تتغير' });
    }

    // بنبني الاستعلام بطريقة آمنة (تجنب SQL injection)
    const result = await sql`
      UPDATE users
      SET ${sql(updates.reduce((acc, u, i) => i === 0 ? u : sql`${acc}, ${u}`))}
      WHERE id = ${user.id}
      RETURNING id, phone, name, avatar_url, status_text, is_verified, is_official
    `;

    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'حصل خطأ في السيرفر، حاول تاني' });
  }
};