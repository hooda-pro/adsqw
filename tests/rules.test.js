// tests/rules.test.js
//
// ⚠️ ده اختبار **شكل** مش اختبار **تشغيل**.
// هو بيقرا firebase-database-rules.json ويتأكد إن القواعد موجودة في المكان
// الصح بالشكل الصح. هو *مش* بيشغّل محرّك القواعد بتاع Firebase، فهو ماينفعش
// يثبت إن قراءة معيّنة هتنجح أو تفشل فعلًا على السيرفر. اللي بيعمل كده هو
// firebase emulators + @firebase/rules-unit-testing، وده محتاج تنزيل حزم
// وجاڤا، وده مش متاح هنا.
//
// بالرغم من كده الاختبار ده مهم: البَق الرئيسي (الرسايل بتظهر على التلفون
// ومش بتظهر على الكمبيوتر، والدردشات بتختفي من الشاشة الرئيسية) كان سببه إن
// الـ .read كان مكتوب على مستوى غلط في الشجرة. القواعد في Firebase بتنزل
// لتحت بس — الابن ماينفعش يعطي الأب صلاحية قراءة. فلو حد شال الـ .read من
// userConversations/$uid تاني، الاختبار ده هو اللي هيمسكه.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RULES_FILE = path.join(__dirname, '..', 'firebase-database-rules.json');

let rules;
test('الملف JSON صحيح وفيه جذر rules', () => {
  const raw = fs.readFileSync(RULES_FILE, 'utf8');
  const parsed = JSON.parse(raw); // بيرمي لو فيه فاصلة زيادة أو تعليق
  assert.ok(parsed.rules, 'لازم يكون فيه مفتاح "rules" في الجذر');
  rules = parsed.rules;
});

// helper: بيمشي على المسار جوه الأوبجكت
function at(obj, ...keys) {
  let cur = obj;
  for (const k of keys) {
    assert.ok(cur && typeof cur === 'object', 'المسار مش موجود عند: ' + k);
    cur = cur[k];
  }
  return cur;
}

test('userConversations/$uid فيه .read — ده بالظبط المستوى اللي الكلاينت بيسمع عليه', () => {
  const node = at(rules, 'userConversations', '$uid');
  assert.strictEqual(typeof node['.read'], 'string', 'مفيش .read على userConversations/$uid');
  assert.match(node['.read'], /auth\.uid\s*===\s*\$uid/, 'القراءة لازم تكون للصاحب بس');
  assert.match(node['.read'], /auth\s*!=\s*null/);
});

test('userConversations/$uid فيه .indexOn لـ lastAt — لازم لـ orderByChild', () => {
  const node = at(rules, 'userConversations', '$uid');
  const idx = node['.indexOn'];
  assert.ok(idx, 'مفيش .indexOn');
  assert.ok([].concat(idx).includes('lastAt'), '.indexOn لازم يشمل lastAt');
});

test('كل حقول userConversations/$uid/$otherUid ليها .write', () => {
  const row = at(rules, 'userConversations', '$uid', '$otherUid');
  const fields = ['convId', 'otherName', 'otherPhone', 'lastMessage', 'lastAt', 'lastSenderId', 'unread', 'myReadAt'];
  for (const f of fields) {
    assert.ok(row[f], 'الحقل ناقص من القواعد: ' + f);
    assert.strictEqual(typeof row[f]['.write'], 'string', 'مفيش .write على الحقل: ' + f);
  }
});

test('myReadAt للصاحب بس — الطرف التاني ماينفعش يعلّم رسايلي مقروءة', () => {
  const w = at(rules, 'userConversations', '$uid', '$otherUid', 'myReadAt')['.write'];
  assert.match(w, /auth\.uid\s*===\s*\$uid/);
  assert.ok(!w.includes('$otherUid'), 'myReadAt مالهاش أي علاقة بـ $otherUid');
});

test('unread الطرف التاني ينفع يزوّدها (عشان العدّاد)', () => {
  const w = at(rules, 'userConversations', '$uid', '$otherUid', 'unread')['.write'];
  assert.match(w, /\$otherUid/, 'الطرف التاني لازم يقدر يزوّد العدّاد بتاعي');
});

test('conversations/$convId فيه .read بيشتق العضوية من الـ id نفسه', () => {
  const node = at(rules, 'conversations', '$convId');
  const r = node['.read'];
  assert.strictEqual(typeof r, 'string', 'مفيش .read على conversations/$convId');
  // نفس الشكل اللي paths.test.js بيتأكد إن conversationId بيطلّعه
  assert.match(r, /\$convId\.matches\(\/\^\[0-9\]\+_\[0-9\]\+\$\/\)/, 'لازم نتأكد من شكل الـ id');
  assert.match(r, /beginsWith\(auth\.uid \+ '_'\)/, 'الشرطة السفلية بتمنع المطابقة الجزئية');
  assert.match(r, /endsWith\('_' \+ auth\.uid\)/);
});

test('conversations/$convId مفيهوش .write على مستوى الأب — الصلاحيات تنزل لتحت بس', () => {
  const node = at(rules, 'conversations', '$convId');
  assert.strictEqual(node['.write'], undefined,
    '.write على الأب بيورّث لكل الأبناء وبيلغي حماية الرسايل من التعديل');
});

test('الرسايل مالهاش تعديل: الكتابة بس لو الرسالة لسه مش موجودة', () => {
  const msg = at(rules, 'conversations', '$convId', 'messages', '$messageId');
  assert.match(msg['.write'], /!data\.exists\(\)/, 'من غير ده الرسايل تنفع تتعدّل أو تتمسح');
  assert.match(msg['.validate'], /senderId'\)\.val\(\) === auth\.uid/, 'ماينفعش تبعت باسم حد تاني');
});

test('messages فيه .indexOn لـ ts', () => {
  const messages = at(rules, 'conversations', '$convId', 'messages');
  assert.ok([].concat(messages['.indexOn'] || []).includes('ts'), '.indexOn لازم يشمل ts');
});

test('حدود حجم الرسالة موجودة', () => {
  const text = at(rules, 'conversations', '$convId', 'messages', '$messageId', 'text');
  assert.match(text['.validate'], /length\s*<=\s*4096/, 'لازم حد أقصى لطول الرسالة');
  assert.match(text['.validate'], /length\s*>\s*0/, 'رسالة فاضية مترفض');
});

test('typing و reads: كل واحد بيكتب لنفسه بس', () => {
  for (const branch of ['typing', 'reads']) {
    const w = at(rules, 'conversations', '$convId', branch, '$uid')['.write'];
    assert.match(w, /auth\.uid\s*===\s*\$uid/, branch + ' لازم تكون للصاحب بس');
    assert.match(w, /\$convId\.matches/, branch + ' لازم تتأكد من العضوية كمان');
  }
});

test('presence: القراءة للطرف اللي عندي دردشة معاه، والكتابة لنفسي بس', () => {
  const node = at(rules, 'presence', '$uid');
  assert.match(node['.write'], /auth\.uid\s*===\s*\$uid/);
  assert.match(node['.read'], /auth\.uid\s*===\s*\$uid|userConversations/,
    'مينفعش أي حد يشوف آخر ظهور أي حد');
});

test('مفيش أي مكان في القواعد فيه true مفتوح', () => {
  const open = [];
  (function walk(node, trail) {
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if ((k === '.read' || k === '.write') && (v === true || v === 'true')) {
        open.push(trail + '/' + k);
      }
      if (v && typeof v === 'object') walk(v, trail + '/' + k);
    }
  })(rules, '');
  assert.deepStrictEqual(open, [], 'قواعد مفتوحة للعالم: ' + open.join(', '));
});
