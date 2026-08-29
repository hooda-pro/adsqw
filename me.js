// api/auth/me.js
// GET with header: Authorization: Bearer <token>
const { sql } = require('../../lib/db');
const { verifyToken, hashToken } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'مفيش تسجيل دخول' });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'الجلسة منتهية، سجل دخول تاني' });
    }

    const tokenHash = hashToken(token);
    const session = await sql`
      SELECT * FROM sessions
      WHERE token_hash = ${tokenHash} AND revoked = false AND expires_at > now()
    `;

    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'الجلسة منتهية، سجل دخول تاني' });
    }

    const result = await sql`
      SELECT id, phone, name, avatar_url, status_text, is_verified, is_official,
             official_display_name, banned, created_at, last_seen_at
      FROM users WHERE id = ${payload.userId}
    `;

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'المستخدم مش موجود' });
    }

    if (user.banned) {
      return res.status(403).json({ error: 'الحساب ده محظور' });
    }

    return res.status(200).json({ user });
  } catch (err) {
    console.error('Me endpoint error:', err);
    return res.status(500).json({ error: 'حصل خطأ في السيرفر' });
  }
};
