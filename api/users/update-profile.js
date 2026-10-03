// api/users/update-profile.js
// PATCH/POST { name?, status_text?, bio?, age?, city?, avatar_url? }
//   - أي حقل مش مبعوت بيفضل زي ما هو.
//   - bio / city / avatar_url بـ '' (أو null) = مسح.
//   - age بـ null أو '' = مسح السن.
// بيستخدم lib/session.js للتحقق من المستخدم
const { sql } = require('../../lib/db');
const { getUserFromRequest } = require('../../lib/session');

const MAX_BIO = 300;
const MAX_CITY = 40;
const MIN_AGE = 13;
const MAX_AGE = 120;
// الصورة بتتصغّر في المتصفح لـ 256px JPEG قبل الرفع — ده حد أمان للسيرفر مش الحجم المعتاد
const MAX_AVATAR_CHARS = 200000;
const AVATAR_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/;

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

module.exports = async (req, res) => {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'الجلسة منتهية، سجل دخول تاني' });
    }

    const body = req.body || {};

    // كل حقل: flag بيقول «اتبعت؟» + القيمة الجديدة. SQL واحد ثابت بدل ما نركّب SET بإيدينا.
    let setName = false, newName = null;
    if (typeof body.name === 'string') {
      newName = body.name.trim();
      if (newName.length < 2) {
        return res.status(400).json({ error: 'الاسم لازم يكون حرفين على الأقل' });
      }
      if (newName.length > 60) {
        return res.status(400).json({ error: 'الاسم طويل أوي (أقصى حاجة 60 حرف)' });
      }
      setName = true;
    }

    let setStatus = false, newStatus = null;
    if (typeof body.status_text === 'string') {
      newStatus = body.status_text.trim().slice(0, 80);
      setStatus = true;
    }

    let setBio = false, newBio = null;
    if (has(body, 'bio')) {
      newBio = body.bio == null ? '' : String(body.bio).trim();
      if (newBio.length > MAX_BIO) {
        return res.status(400).json({ error: `التعريف طويل أوي (أقصى حاجة ${MAX_BIO} حرف)` });
      }
      setBio = true;
    }

    let setCity = false, newCity = null;
    if (has(body, 'city')) {
      newCity = body.city == null ? '' : String(body.city).trim();
      if (newCity.length > MAX_CITY) {
        return res.status(400).json({ error: `اسم المدينة طويل أوي (أقصى حاجة ${MAX_CITY} حرف)` });
      }
      setCity = true;
    }

    let setAge = false, newAge = null;
    if (has(body, 'age')) {
      if (body.age === null || body.age === '') {
        newAge = null;
      } else {
        const n = Number(body.age);
        if (!Number.isInteger(n) || n < MIN_AGE || n > MAX_AGE) {
          return res.status(400).json({ error: `السن لازم يكون رقم بين ${MIN_AGE} و ${MAX_AGE}` });
        }
        newAge = n;
      }
      setAge = true;
    }

    let setAvatar = false, newAvatar = null;
    if (has(body, 'avatar_url')) {
      if (body.avatar_url === null || body.avatar_url === '') {
        newAvatar = null; // مسح الصورة
      } else {
        const v = String(body.avatar_url);
        if (v.length > MAX_AVATAR_CHARS || !AVATAR_RE.test(v)) {
          return res.status(400).json({ error: 'الصورة مش صالحة، جرّب صورة تانية' });
        }
        newAvatar = v;
      }
      setAvatar = true;
    }

    if (!setName && !setStatus && !setBio && !setCity && !setAge && !setAvatar) {
      return res.status(400).json({ error: 'مفيش حاجات تتغير' });
    }

    // @vercel/postgres's `sql` only works as a tagged template — فبنستخدم CASE لكل حقل
    const result = await sql`
      UPDATE users SET
        name        = CASE WHEN ${setName}::boolean   THEN ${newName}      ELSE name        END,
        status_text = CASE WHEN ${setStatus}::boolean THEN ${newStatus}    ELSE status_text END,
        bio         = CASE WHEN ${setBio}::boolean    THEN ${newBio}       ELSE bio         END,
        city        = CASE WHEN ${setCity}::boolean   THEN ${newCity}      ELSE city        END,
        age         = CASE WHEN ${setAge}::boolean    THEN ${newAge}::smallint ELSE age     END,
        avatar_url  = CASE WHEN ${setAvatar}::boolean THEN ${newAvatar}    ELSE avatar_url  END,
        updated_at  = now()
      WHERE id = ${user.id}
      RETURNING id, phone, name, avatar_url, status_text, bio, age, city, is_verified, is_official
    `;

    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'حصل خطأ في السيرفر، حاول تاني' });
  }
};
