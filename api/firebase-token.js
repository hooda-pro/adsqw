// api/firebase-token.js
// GET — لازم تتنادى بعد ما المستخدم يسجل دخول (أو تتأكد من جلسته) عشان الفرونت إند
// ياخد token يقدر يسجل بيه دخول على Firebase ويستخدم الرسائل الفورية.
// Header: Authorization: Bearer <token بتاع نظام تسجيل الدخول عندك (JWT العادي)>
const { getUserFromRequest } = require('../lib/session');
const { admin } = require('../lib/firebase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'سجل دخول الأول' });
    }

    // الـ uid في Firebase = نفس الـ id بتاعه في قاعدة البيانات (كنص)
    // عشان يفضل ثابت ومربوط بحسابه في كل الأجهزة
    const firebaseToken = await admin.auth().createCustomToken(String(user.id), {
      name: user.name,
      phone: user.phone,
    });

    return res.status(200).json({ firebaseToken });
  } catch (err) {
    console.error('Firebase token error:', err);
    return res.status(500).json({ error: 'حصل خطأ في السيرفر، حاول تاني' });
  }
};
