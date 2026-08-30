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

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

module.exports = { admin };
