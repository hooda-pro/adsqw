// lib/db.js
// اتصال قاعدة البيانات (Neon Postgres عن طريق @vercel/postgres)
// لازم تحط DATABASE_URL أو POSTGRES_URL في Environment Variables على Vercel

const { sql } = require('@vercel/postgres');

module.exports = { sql };
