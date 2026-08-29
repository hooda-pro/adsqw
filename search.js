// api/users/search.js
// GET /api/users/search?phone=010...
// Header: Authorization: Bearer <token>
const { sql } = require('../../lib/db');
const { getUserFromRequest } = require('../../lib/session');
const { normalizePhone } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const me = await getUserFromRequest(req);
    if (!me) {
      return res.status(401).json({ error: 'سجل دخول الأول' });
    }

    const rawPhone = req.query.phone || '';
    const phone = normalizePhone(rawPhone);

    if (phone.length < 3) {
      return res.status(400).json({ error: 'اكتب أرقام أكتر عشان نقدر ندور' });
    }

    const results = await sql`
      SELECT id, phone, name, avatar_url, status_text, is_verified, is_official, official_display_name
      FROM users
      WHERE phone ILIKE ${'%' + phone + '%'}
        AND banned = false
        AND id != ${me.id}
      ORDER BY
        CASE WHEN phone = ${phone} THEN 0 ELSE 1 END,
        name ASC
      LIMIT 20
    `;

    return res.status(200).json({ users: results.rows });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'حصل خطأ في السيرفر' });
  }
};
