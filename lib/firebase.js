// lib/firebase.js
// تهيئة Firebase Admin SDK — مستخدم بس عشان نصدر "custom token" للمستخدم بعد ما يسجل دخول
// عادي في نظامك (Postgres/JWT)، عشان يقدر يسجل دخول بيه على Firebase من المتصفح
// ويستقبل/يبعت رسائل فورية (Realtime Database). مفيش بيانات مستخدمين حساسة بتتخزن هنا.
//
// لازم تحط في Environment Variables على Vercel (شوف الجزء 8 في SETUP-GUIDE.md):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   -> أسهل وأضمن طريقة: حط قيمة مُكودة base64 (سطر واحد، من غير \n أو علامات تنصيص).
//                             الكود تحت بيكتشفها ويفكها تلقائي. برضو بيشتغل لو حطيت المفتاح الخام العادي.
//   FIREBASE_DATABASE_URL  -> شكلها: https://<project-id>-default-rtdb.<region>.firebasedatabase.app

const admin = require('firebase-admin');

// بتنضف/تفك الـ private key من أخطاء النسخ الشائعة قبل ما تستخدمه:
// - لو القيمة base64 (مفيهاش "BEGIN PRIVATE KEY")، بتفكها الأول.
// - بتشيل أي علامات تنصيص زيادة حواليها.
// - بتظبط شكل الأسطر (\n هروب أو \r\n ويندوز) لسطر جديد حقيقي.
function normalizePrivateKey(raw) {
  let key = (raw || '').trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  if (!key.includes('BEGIN')) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8');
      if (decoded.includes('BEGIN')) {
        key = decoded.trim();
      }
    } catch (e) {
      // مش base64 صالح، سيبها زي ما هي وكمّل عادي
    }
  }

  key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();

  return key.endsWith('\n') ? key : key + '\n';
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
