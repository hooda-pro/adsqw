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

    let newName = null;
    if (typeof name === 'string') {
      newName = name.trim();
      if (newName.length < 2) {
        return res.status(400).json({ error: 'الاسم لازم يكون حرفين على الأقل' });
      }
    }

    let newStatus = null;
    if (typeof status_text === 'string') {
      newStatus = status_text.trim().slice(0, 80);
    }

    if (newName === null && newStatus === null) {
      return res.status(400).json({ error: 'مفيش حاجات تتغير' });
    }

    // @vercel/postgres's `sql` only works as a tagged template — it can't be
    // called as a function or have query fragments composed dynamically.
    // So instead of building the SET clause piece-by-piece, we branch over
    // the (small, known) set of update combinations, each as its own
    // plain tagged-template query.
    let result;
    if (newName !== null && newStatus !== null) {
      result = await sql`
        UPDATE users
        SET name = ${newName}, status_text = ${newStatus}
        WHERE id = ${user.id}
        RETURNING id, phone, name, avatar_url, status_text, is_verified, is_official
      `;
    } else if (newName !== null) {
      result = await sql`
        UPDATE users
        SET name = ${newName}
        WHERE id = ${user.id}
        RETURNING id, phone, name, avatar_url, status_text, is_verified, is_official
      `;
    } else {
      result = await sql`
        UPDATE users
        SET status_text = ${newStatus}
        WHERE id = ${user.id}
        RETURNING id, phone, name, avatar_url, status_text, is_verified, is_official
      `;
    }

    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'حصل خطأ في السيرفر، حاول تاني' });
  }
};