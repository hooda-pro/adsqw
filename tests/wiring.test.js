// tests/wiring.test.js
// app.js بيمسك كل عناصر الصفحة عن طريق id في أوبجكت واحد (el). لو id اتغير في
// index.html ونُسي في app.js، النتيجة بتبقى TypeError صامت على عنصر null —
// وده اللي بيخلي زرار أو فورم يبقى "ميّت" من غير أي رسالة خطأ.
// الاختبار ده بيقرا الاتنين ويقارن.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'js', 'app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

const htmlIds = new Set([...HTML.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

/** الـ ids اللي app.js بيدوّر عليها جوه أوبجكت el */
function appIds() {
  const block = APP.match(/const el = \{([\s\S]*?)\n {2}\};/);
  assert.ok(block, 'مش لاقي أوبجكت el في app.js — الاختبار ده محتاج تحديث');
  return [...block[1].matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
}

test('كل id بيستخدمه app.js موجود في index.html', () => {
  const missing = appIds().filter((id) => !htmlIds.has(id));
  assert.deepStrictEqual(missing, [], 'ids مفقودة من index.html: ' + missing.join(', '));
});

test('مفيش id متكرر في index.html', () => {
  const all = [...HTML.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = all.filter((id, i) => all.indexOf(id) !== i);
  assert.deepStrictEqual([...new Set(dupes)], [], 'ids متكررة: ' + dupes.join(', '));
});

test('el بيغطّي كل العناصر المهمة للشاشات التلاتة', () => {
  const ids = new Set(appIds());
  const required = [
    'loginForm', 'signupForm', 'loginPhone', 'signupPhone',     // الدخول
    'chatList', 'chatFilter', 'newChatBtn', 'logoutBtn',        // القائمة
    'chatView', 'messages', 'composerForm', 'composerInput',    // الشات
    'searchForm', 'searchPhone', 'searchOut',                   // البحث
    'toasts',
  ];
  for (const r of required) assert.ok(ids.has(r), 'app.js مش ماسك العنصر: ' + r);
});

test('صندوق الكتابة textarea مش input — عشان النص ينزل تحت مايفرّحش', () => {
  assert.match(HTML, /<textarea[^>]+id="composerInput"/,
    'لو بقى <input> النص الطويل هيفرّح الصف الأفقي');
  const css = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');
  const rule = css.match(/#composerInput\s*\{([\s\S]*?)\}/);
  assert.ok(rule, 'مفيش قاعدة CSS لـ #composerInput');
  assert.match(rule[1], /resize:\s*none/);
  assert.match(rule[1], /max-height/, 'لازم حد أقصى للطول وإلا بياكل الشاشة كلها');
  assert.match(rule[1], /overflow-wrap:\s*anywhere/, 'كلمة طويلة من غير مسافات لازم تتقطّع');
});

test('الصفحة عربي و RTL', () => {
  assert.match(HTML, /<html[^>]+lang="ar"/);
  assert.match(HTML, /<html[^>]+dir="rtl"/);
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'manifest.json'), 'utf8'));
  assert.strictEqual(manifest.lang, 'ar');
  assert.strictEqual(manifest.dir, 'rtl');
});

test('في RTL رسايلي على الشمال ورسايل التاني على اليمين — زي واتساب العربي', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');
  const mine = css.match(/\.msg\.is-mine\s*\{([\s\S]*?)\}/);
  const theirs = css.match(/\.msg\.is-theirs\s*\{([\s\S]*?)\}/);
  assert.ok(mine && theirs, 'مفيش قواعد is-mine / is-theirs');
  assert.match(mine[1], /align-self:\s*flex-end/, 'في RTL دي ناحية الشمال');
  assert.match(theirs[1], /align-self:\s*flex-start/, 'في RTL دي ناحية اليمين');
});

test('التصميم فيه شاشة كمبيوتر منفصلة (لوحين جنب بعض)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');
  assert.match(css, /@media \(min-width: 900px\)/, 'مفيش نقطة تحوّل للكمبيوتر');
  assert.match(css, /grid-template-columns/, 'الكمبيوتر المفروض لوحين');
  assert.match(css, /prefers-reduced-motion/, 'احترام تقليل الحركة');
});

test('مفيش innerHTML على نص جاي من مستخدم تاني', () => {
  // نص الرسايل والأسماء لازم يتحط بـ textContent / createTextNode
  const bad = [...APP.matchAll(/\.innerHTML\s*=\s*([^;\n]+)/g)].map((m) => m[1].trim());
  const risky = bad.filter((v) => v !== "''" && v !== '""' && v !== '``');
  assert.deepStrictEqual(risky, [], 'innerHTML بقيمة مش فاضية: ' + risky.join(' | '));
});

test('مفيش alert أو confirm — الرسايل بتظهر كـ toast', () => {
  assert.ok(!/(^|[^.\w])alert\s*\(/.test(APP), 'لسه فيه alert() في app.js');
  assert.ok(!/(^|[^.\w])confirm\s*\(/.test(APP), 'لسه فيه confirm() في app.js');
});

test('كل سماعة Firebase ليها callback للخطأ — عشان الفشل مايبقاش صامت', () => {
  // ده جوهر البَق الأصلي: permission_denied كان بيرجع من غير أي أثر ظاهر
  const onCalls = APP.split(/\.on\(/).length - 1;
  assert.ok(onCalls >= 4, 'المفروض فيه سماعات للرسايل والقائمة والكتابة والتواجد');
  const errHandlers = (APP.match(/\(err\)\s*=>/g) || []).length;
  assert.ok(errHandlers >= onCalls,
    `سماعات: ${onCalls} — معالجات خطأ: ${errHandlers}. لازم كل سماعة يكون لها معالج.`);
});

test('participants بتتكتب بـ update مش set — set بتمسح الطرف التاني', () => {
  assert.match(APP, /Paths\.participants\([^)]*\)\)\.update\(/,
    'set() على participants بتشيل الطرف التاني من المحادثة');
});
