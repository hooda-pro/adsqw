// lib/session.js
const { sql } = require('./db');
const { verifyToken, hashToken } = require('./auth');

// بياخد الـ request ويرجع المستخدم الحالي لو التوكن صحيح وسليم، أو null لو لأ
async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const tokenHash = hashToken(token);
  const session = await sql`
    SELECT id FROM sessions
    WHERE token_hash = ${tokenHash} AND revoked = false AND expires_at > now()
  `;
  if (session.rows.length === 0) return null;

  const result = await sql`
    SELECT id, phone, name, avatar_url, status_text, is_verified, is_official,
           official_display_name, banned, created_at, last_seen_at
    FROM users WHERE id = ${payload.userId}
  `;
  const user = result.rows[0];
  if (!user || user.banned) return null;

  return user;
}

module.exports = { getUserFromRequest };
