// api/users/search.js
// GET /api/users/search?phone=01012345678
// Header: Authorization: Bearer <token>
//
// خصوصية: البحث بالرقم الكامل بالظبط بس.
//   - مفيش ILIKE ولا '%' ولا بحث جزئي — يعني «010» مش بترجّع أي حد.
//   - أقصى نتيجة واحدة (الرقم unique في الداتابيز أصلًا).
//   - حد أقصى للمحاولات لكل مستخدم عشان محدش يفضل يجرب أرقام واحد ورا التاني.
const { sql } = require('../../lib/db');
const { getUserFromRequest } = require('../../lib/session');
const { canonicalPhone, isValidPhone, phoneVariants, phoneError } = require('../../lib/phone');

// 20 بحثة كل 5 دقايق لكل مستخدم
const SEARCH_LIMIT = 20;
const WINDOW_MINUTES = 5;

/**
 * عدّاد بحث لكل مستخدم في شبّاك زمني متجدد.
 * لو الجدول لسه مش موجود (المستخدم مشغّلش schema.sql الجديد) بنسمح بالبحث
 * وبنسجّل تحذير — أهون من إننا نكسّر البحث خالص.
 */
async function checkSearchRateLimit(userId) {
  try {
    const { rows } = await sql`
      INSERT INTO search_rate_limit (user_id, window_start, attempts)
      VALUES (${userId}, now(), 1)
      ON CONFLICT (user_id) DO UPDATE SET
        window_start = CASE
          WHEN search_rate_limit.window_start < now() - (${WINDOW_MINUTES} * interval '1 minute')
          THEN now() ELSE search_rate_limit.window_start END,
        attempts = CASE
          WHEN search_rate_limit.window_start < now() - (${WINDOW_MINUTES} * interval '1 minute')
          THEN 1 ELSE search_rate_limit.attempts + 1 END
      RETURNING attempts
    `;
    const attempts = rows[0] ? Number(rows[0].attempts) : 1;
    return { allowed: attempts <= SEARCH_LIMIT, attempts };
  } catch (err) {
    if (err && err.code === '42P01') {
      console.warn('search_rate_limit table missing — run schema.sql to enable search rate limiting');
      return { allowed: true, attempts: 0 };
    }
    throw err;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const me = await getUserFromRequest(req);
    if (!me) {
      return res.status(401).json({ error: 'سجل دخول الأول' });
    }

    const raw = req.query.phone || '';

    // لازم رقم كامل صالح — أي حاجة ناقصة بترجع نفس رسالة الواجهة بالظبط
    if (!isValidPhone(raw)) {
      return res.status(400).json({ error: phoneError(raw) || 'اكتب رقم الهاتف بالكامل' });
    }

    const limit = await checkSearchRateLimit(me.id);
    if (!limit.allowed) {
      return res.status(429).json({
        error: `بحثت كتير في وقت قصير — استنى ${WINDOW_MINUTES} دقايق وحاول تاني`,
      });
    }

    const canonical = canonicalPhone(raw);
    const variants = phoneVariants(raw);

    // مقارنة تساوي تام على كل الصيغ اللي ممكن الرقم يكون متخزّن بيها من نسخ قديمة
    const { rows } = await sql`
      SELECT id, phone, name, avatar_url, status_text, is_verified, is_official, official_display_name
      FROM users
      WHERE phone = ANY(${variants})
        AND banned = false
        AND id <> ${me.id}
      LIMIT 1
    `;

    // بنرجّع الرقم بصيغته القياسية عشان الواجهة تبني نفس الـ id للمحادثة دايمًا
    const users = rows.map((u) => ({ ...u, phone: canonical || u.phone }));

    return res.status(200).json({ users });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'حصل خطأ في السيرفر' });
  }
};
