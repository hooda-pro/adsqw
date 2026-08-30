// lib/firebase.js
// تهيئة Firebase Admin SDK — مستخدم بس عشان نصدر "custom token" للمستخدم بعد ما يسجل دخول
// عادي في نظامك (Postgres/JWT)، عشان يقدر يسجل دخول بيه على Firebase من المتصفح
// ويستقبل/يبعت رسائل فورية (Realtime Database). مفيش بيانات مستخدمين حساسة بتتخزن هنا.
//
// لازم تحط في Environment Variables على Vercel (شوف الجزء 8 في SETUP-GUIDE.md):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   -> خد بالك: انسخ المفتاح كامل واستبدل كل سطر جديد فيه بـ \n (الكود تحت بيرجعه تاني تلقائي)
//   FIREBASE_DATABASE_URL  -> شكلها: https://<project-id>-default-rtdb.<region>.firebasedatabase.app

const admin = require('firebase-admin');

// بتنضف الـ private key من أخطاء النسخ الشائعة (علامات تنصيص زيادة حواليها،
// أو \r من ويندوز، أو مسافات فاضية في الأول أو الآخر) قبل ما تستبدل \n بسطر جديد حقيقي.
function normalizePrivateKey(raw) {
  let key = (raw || '').trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

module.exports = { admin };
