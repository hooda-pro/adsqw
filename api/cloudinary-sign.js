// api/cloudinary-sign.js
// POST /api/cloudinary-sign
// Header: Authorization: Bearer <token بتاع نظام تسجيل الدخول عندك>
// Body:   { "convId": "1_2" }
//
// ليه محتاجين الملف ده أصلاً؟
// رفع الصور والفيديوهات بيتم على Cloudinary (بديل مجاني لـ Firebase Storage،
// من غير ما تحتاج تربط كارت بنكي خالص). لرفع آمن، Cloudinary محتاج "توقيع"
// (signature) لكل عملية رفع — والتوقيع ده لازم يتعمل هنا في السيرفر بس،
// عشان الـ API Secret بتاعك (الجزء السري) مايظهرش أبدًا في كود المتصفح.
// لو حد قدر ياخد الـ API Secret، يقدر يرفع أي حاجة على حسابك من غير إذن.
//
// لازم تحط في Environment Variables على Vercel (شوف الجزء 8.6 في SETUP-GUIDE.md):
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
const crypto = require('crypto');
const { getUserFromRequest } = require('../lib/session');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'سجل دخول الأول' });
    }

    const { cloudName, apiKey, apiSecret } = {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    };
    if (!cloudName || !apiKey || !apiSecret) {
      console.error('Cloudinary env vars missing — راجع الجزء 8.6 في SETUP-GUIDE.md');
      return res.status(500).json({ error: 'الرفع مش متفعّل على السيرفر لسه' });
    }

    // convId لازم يكون شكله "id1_id2" واليوزر الحالي لازم يكون طرف فيه —
    // نفس فكرة قواعد الأمان في Firebase بالظبط، هنا كمان محدش يرفع لمحادثة مش بتاعته
    const convId = String((req.body && req.body.convId) || '');
    const parts = convId.split('_');
    if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) {
      return res.status(400).json({ error: 'convId غلط' });
    }
    if (String(user.id) !== parts[0] && String(user.id) !== parts[1]) {
      return res.status(403).json({ error: 'مش طرف في المحادثة دي' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'chat-media/' + convId;

    // Cloudinary بتوقّع بالضبط الحقول اللي هتتبعت (غير الملف نفسه وapi_key/signature)،
    // مرتّبة أبجديًا، متسلسلة بـ &، وبعدين SHA-1 مع الـ API Secret في الآخر
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash('sha1')
      .update(paramsToSign + apiSecret)
      .digest('hex');

    return res.status(200).json({ cloudName, apiKey, timestamp, folder, signature });
  } catch (err) {
    console.error('Cloudinary sign error:', err);
    return res.status(500).json({ error: 'حصل خطأ في السيرفر، حاول تاني' });
  }
};
