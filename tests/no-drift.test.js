// tests/no-drift.test.js
// البَق اللي ضيّع وقت كتير كان نسخة قديمة من نفس الكود موجودة في مكانين:
// المتصفح كان بيقرا نسخة، والسيرفر نسخة تانية، والاتنين اختلفوا.
// الحل إن lib/phone.js بيعمل re-export لـ public/js/phone.js (ملف واحد UMD
// بيشتغل في المتصفح وفي Node). الاختبار ده بيتأكد إن ده لسه صحيح.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('lib/phone و public/js/phone.js نفس الموديول بالظبط', () => {
  const lib = require('../lib/phone');
  const pub = require('../public/js/phone.js');
  assert.strictEqual(lib, pub, 'لو مش نفس الأوبجكت يبقى فيه نسختين هيختلفوا');
});

test('نفس الدوال متصدَّرة من الاتنين', () => {
  const lib = require('../lib/phone');
  for (const fn of ['canonicalPhone', 'isValidPhone', 'phoneVariants', 'phoneError', 'formatPhoneForDisplay']) {
    assert.strictEqual(typeof lib[fn], 'function', 'الدالة ناقصة: ' + fn);
  }
  assert.ok(Array.isArray(lib.EG_MOBILE_PREFIXES) && lib.EG_MOBILE_PREFIXES.length > 0);
});

test('مفيش نسخ قديمة من ملفات الواجهة في جذر المشروع', () => {
  // النسخ القديمة اتنقلت لـ _old/ ، ولو رجعت للجذر تاني المتصفح ممكن يقراها
  const strays = ['script.js', 'index.html', 'style.css', 'app.js', 'sw.js'];
  for (const f of strays) {
    assert.strictEqual(fs.existsSync(path.join(ROOT, f)), false,
      f + ' موجود في الجذر — النسخة اللي بتتقدّم هي public/' + f);
  }
});

test('مفيش أي ملف .js متكرر بنفس الاسم بين public/js و lib غير phone.js', () => {
  const pubJs = fs.readdirSync(path.join(ROOT, 'public', 'js')).filter((f) => f.endsWith('.js'));
  const libJs = fs.readdirSync(path.join(ROOT, 'lib')).filter((f) => f.endsWith('.js'));
  const shared = pubJs.filter((f) => libJs.includes(f));
  // phone.js مسموح: lib/phone.js بيعمل require للنسخة في public
  assert.deepStrictEqual(shared, ['phone.js'],
    'ملفات متكررة بين lib و public/js: ' + shared.join(', '));
  const libPhone = fs.readFileSync(path.join(ROOT, 'lib', 'phone.js'), 'utf8');
  assert.match(libPhone, /require\(.*public\/js\/phone/,
    'lib/phone.js لازم يعمل re-export مش نسخ ولصق');
});

test('الملفات اللي sw.js بيكاشها موجودة فعلًا', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
  const block = sw.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(block, 'مش لاقي قايمة SHELL في sw.js');
  const paths = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(paths.length > 0);
  for (const p of paths) {
    if (p === '/') continue; // ده index.html
    const onDisk = path.join(ROOT, 'public', p.replace(/^\//, ''));
    assert.ok(fs.existsSync(onDisk), 'sw.js بيكاش ملف مش موجود: ' + p);
  }
});

test('كل السكربتات اللي index.html بيحمّلها من نفس السيرفر موجودة', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  const local = srcs.filter((s) => s.startsWith('/'));
  assert.ok(local.length >= 4, 'المفروض phone/format/paths/app كلهم محمّلين');
  for (const s of local) {
    const onDisk = path.join(ROOT, 'public', s.replace(/^\//, '').split('?')[0]);
    assert.ok(fs.existsSync(onDisk), 'index.html بيحمّل ملف مش موجود: ' + s);
  }
});

test('كل ملفات الـ CSS اللي index.html بيحمّلها موجودة', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const hrefs = [...html.matchAll(/<link[^>]+href="(\/[^"]+)"/g)].map((m) => m[1]);
  for (const h of hrefs) {
    const onDisk = path.join(ROOT, 'public', h.replace(/^\//, '').split('?')[0]);
    assert.ok(fs.existsSync(onDisk), 'index.html بيشاور على ملف مش موجود: ' + h);
  }
});
