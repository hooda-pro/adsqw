// api/auth/me.js
// GET with header: Authorization: Bearer <token>
// بيستخدم lib/session.js — مفيش نسخة تانية من منطق التحقق هنا.
const { sql } = require('../../lib/db');
const { getUserFromRequest } = require('../../lib/session');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'الجلسة منتهية، سجل دخول تاني' });
    }

    // آخر ظهور — مفيد للوحة الأدمن، مش بيعطّل الرد لو فشل
    sql`UPDATE users SET last_seen_at = now() WHERE id = ${user.id}`.catch(() => {});

    return res.status(200).json({ user });
  } catch (err) {
    console.error('Me endpoint error:', err);
    return res.status(500).json({ error: 'حصل خطأ في السيرفر' });
  }
};
