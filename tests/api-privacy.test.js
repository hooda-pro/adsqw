// tests/api-privacy.test.js
// اختبارات ثابتة (بتقرا الكود مش بتشغّله) على نقاط الـ API الحسّاسة.
// السبب: تشغيلها محتاج داتابيز Postgres حقيقية، بس أهم الشروط هنا هي شروط
// «مايحصلش» — مفيش ILIKE، مفيش '%', مفيش كلمة سر بترجع في الـ JSON — وده
// ينفع يتأكد من الكود نفسه بشكل موثوق.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
/** بيشيل التعليقات — التعليق اللي فيه كلمة ILIKE مش نفس الـ SQL اللي فيه ILIKE */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const SEARCH = read('api/users/search.js');
const SEARCH_CODE = stripComments(SEARCH);

test('البحث: مفيش ILIKE ولا LIKE ولا % — يعني «010» ماتجيبش حد', () => {
  assert.ok(!/ILIKE/i.test(SEARCH_CODE), 'ILIKE معناها بحث جزئي — ده تسريب بيانات');
  assert.ok(!/\bLIKE\b/i.test(SEARCH_CODE), 'LIKE برضه بحث جزئي');
  const sqlBlocks = [...SEARCH_CODE.matchAll(/sql`([\s\S]*?)`/g)].map((m) => m[1]);
  assert.ok(sqlBlocks.length > 0, 'مش لاقي أي استعلام');
  for (const q of sqlBlocks) {
    assert.ok(!q.includes('%'), 'علامة % في استعلام: ' + q.slice(0, 60));
  }
});

test('البحث: الرقم بيتحقق منه بالكامل قبل أي استعلام', () => {
  assert.match(SEARCH, /isValidPhone\(raw\)/, 'لازم نتأكد إن الرقم كامل الأول');
  const validateIdx = SEARCH.indexOf('isValidPhone');
  const queryIdx = SEARCH.indexOf('FROM users');
  assert.ok(validateIdx > -1 && queryIdx > validateIdx,
    'التحقق لازم يكون قبل الاستعلام في الكود');
});

test('البحث: نتيجة واحدة بالكتير، والمحظورين ونفسي مستثنيين', () => {
  const q = SEARCH.match(/FROM users[\s\S]*?`/)[0];
  assert.match(q, /LIMIT 1/, 'مفيش داعي لأكتر من نتيجة — الرقم unique');
  assert.match(q, /banned = false/, 'المحظور مايظهرش في البحث');
  assert.match(q, /id <> \$\{me\.id\}/, 'مايظهرش لنفسي في نتايج البحث');
});

test('البحث: مفيش أي عمود سري في الـ SELECT', () => {
  const q = SEARCH.match(/SELECT([\s\S]*?)FROM users/)[1];
  for (const secret of ['password', 'password_hash', 'token', 'jti', 'failed']) {
    assert.ok(!q.includes(secret), 'عمود حساس في نتيجة البحث: ' + secret);
  }
  assert.ok(!/SELECT\s+\*/.test(SEARCH), 'SELECT * بيرجّع أعمدة مش مقصودة');
});

test('البحث: فيه حد أقصى للمحاولات عشان محدش يجرّب أرقام واحد ورا التاني', () => {
  assert.match(SEARCH, /SEARCH_LIMIT/);
  assert.match(SEARCH, /status\(429\)/, 'لازم نرجّع 429 لما يتعدى الحد');
  const limit = Number(SEARCH.match(/SEARCH_LIMIT = (\d+)/)[1]);
  assert.ok(limit > 0 && limit <= 60, 'حد معقول: ' + limit);
});

test('البحث: محتاج تسجيل دخول', () => {
  assert.match(SEARCH, /getUserFromRequest\(req\)/);
  assert.match(SEARCH, /status\(401\)/);
});

test('كل نقاط الـ API بتتحقق من نوع الطلب', () => {
  const files = ['api/users/search.js', 'api/auth/login.js', 'api/auth/signup.js', 'api/auth/me.js'];
  for (const f of files) {
    const src = read(f);
    assert.match(src, /req\.method !== '(GET|POST)'/, f + ' مش بيتحقق من req.method');
    assert.match(src, /405/, f + ' المفروض يرجّع 405');
  }
});

test('التسجيل والدخول: الباسورد مايرجعش في أي رد', () => {
  for (const f of ['api/auth/login.js', 'api/auth/signup.js', 'api/auth/me.js']) {
    const src = read(f);
    const responses = [...src.matchAll(/json\(\{([\s\S]{0,400}?)\}\)/g)].map((m) => m[1]);
    for (const r of responses) {
      assert.ok(!/password/i.test(r), f + ' فيه password في الرد');
    }
  }
});

test('مفيش أي سر مكتوب في الكود — كله من متغيرات البيئة', () => {
  const files = [
    'api/auth/login.js', 'api/auth/signup.js', 'api/auth/me.js',
    'api/users/search.js', 'lib/session.js', 'lib/db.js',
  ];
  for (const f of files) {
    const src = read(f);
    // JWT_SECRET / POSTGRES_URL / مفاتيح Firebase لازم تيجي من process.env بس
    const assigns = [...src.matchAll(/(JWT_SECRET|PRIVATE_KEY|POSTGRES_URL|CLIENT_EMAIL)\s*=\s*(['"`])/g)];
    assert.deepStrictEqual(assigns.map((m) => m[1]), [],
      f + ' فيه سر مكتوب في الكود');
    if (/JWT_SECRET/.test(src)) {
      assert.match(src, /process\.env\.JWT_SECRET/, f + ' لازم يقرا JWT_SECRET من البيئة');
    }
  }
});

test('التوكن متخزّن كهاش مش كنص — لو الداتابيز اتسربت التوكنات ماتنفعش', () => {
  const auth = read('lib/auth.js');
  assert.match(auth, /function hashToken/, 'مفيش دالة hashToken');
  assert.match(auth, /createHash\('sha256'\)/, 'لازم هاش SHA-256 للتوكن');
  const session = read('lib/session.js');
  assert.match(session, /hashToken\(token\)/, 'البحث في sessions لازم يكون بالهاش');
  assert.match(session, /token_hash = \$\{tokenHash\}/, 'مفيش مقارنة بالهاش');
  assert.match(session, /revoked = false/, 'التوكن الملغي لازم يترفض');
  assert.match(session, /expires_at > now\(\)/, 'التوكن المنتهي لازم يترفض');
});

test('كلمة السر بـ bcrypt مش هاش عادي', () => {
  const auth = read('lib/auth.js');
  assert.match(auth, /bcrypt\.hash\(/, 'لازم bcrypt للباسورد');
  assert.match(auth, /bcrypt\.compare\(/);
  const rounds = Number(auth.match(/bcrypt\.hash\([^,]+,\s*(\d+)/)[1]);
  assert.ok(rounds >= 10, 'عدد الجولات قليل: ' + rounds);
});

test('schema.sql فيه جدول حد البحث اللي الكود بيعتمد عليه', () => {
  const schema = read('schema.sql');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS search_rate_limit/);
  assert.match(schema, /REFERENCES users\(id\) ON DELETE CASCADE/);
});

test('عمود الهاتف unique — أساس إن نتيجة واحدة تكفي', () => {
  const schema = read('schema.sql');
  const users = schema.match(/CREATE TABLE IF NOT EXISTS users \(([\s\S]*?)\n\);/);
  assert.ok(users, 'مش لاقي جدول users');
  assert.match(users[1], /phone[\s\S]*?UNIQUE/, 'phone لازم يكون UNIQUE');
});
