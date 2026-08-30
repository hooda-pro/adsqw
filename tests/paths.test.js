// tests/paths.test.js
// id المحادثة لازم يكون نفسه عند الطرفين — لو اختلف، كل واحد بيكتب في شجرة
// مختلفة وبيبقى شكله كأن الرسايل "مش بتوصل".
const test = require('node:test');
const assert = require('node:assert');
const Paths = require('../public/js/paths.js');

test('conversationId: نفس القيمة بغض النظر عن الترتيب', () => {
  assert.strictEqual(Paths.conversationId(1, 2), Paths.conversationId(2, 1));
  assert.strictEqual(Paths.conversationId('7', '31'), Paths.conversationId('31', '7'));
  assert.strictEqual(Paths.conversationId(12, '12'), Paths.conversationId('12', 12));
});

test('conversationId: رقم أو نص نفس النتيجة', () => {
  assert.strictEqual(Paths.conversationId(3, 9), Paths.conversationId('3', '9'));
});

test('conversationId: الشكل هو رقمين بينهم شرطة سفلية — نفس اللي القواعد بتتحقق منه', () => {
  const samples = [[1, 2], [10, 9], [123, 4567], [7, 7]];
  for (const [a, b] of samples) {
    assert.match(Paths.conversationId(a, b), /^[0-9]+_[0-9]+$/);
  }
});

test('conversationId: كل طرف موجود في الـ id (شرط قواعد الأمان)', () => {
  const pairs = [[1, 2], [9, 10], [31, 7], [100, 25]];
  for (const [a, b] of pairs) {
    const id = Paths.conversationId(a, b);
    const belongs = (uid) => id.startsWith(uid + '_') || id.endsWith('_' + uid);
    assert.ok(belongs(String(a)), a + ' لازم يكون طرف في ' + id);
    assert.ok(belongs(String(b)), b + ' لازم يكون طرف في ' + id);
  }
});

test('conversationId: شخص تالت مش طرف في المحادثة', () => {
  const id = Paths.conversationId(10, 12);
  const belongs = (uid) => id.startsWith(uid + '_') || id.endsWith('_' + uid);
  // ID زي "10_12" — لازم "1" و"2" مايتحسبوش أطراف بسبب المطابقة الجزئية
  assert.strictEqual(belongs('1'), false, 'الشرطة السفلية بتمنع المطابقة الجزئية');
  assert.strictEqual(belongs('2'), false);
  assert.strictEqual(belongs('101'), false);
});

test('مسارات الشجرة بالشكل المتوقع', () => {
  const cid = Paths.conversationId(4, 5);
  assert.strictEqual(cid, '4_5');
  assert.strictEqual(Paths.messages(cid), 'conversations/4_5/messages');
  assert.strictEqual(Paths.participants(cid), 'conversations/4_5/participants');
  assert.strictEqual(Paths.typing(cid, '4'), 'conversations/4_5/typing/4');
  assert.strictEqual(Paths.reads(cid, '5'), 'conversations/4_5/reads/5');
  assert.strictEqual(Paths.userChats('4'), 'userConversations/4');
  assert.strictEqual(Paths.userChat('4', '5'), 'userConversations/4/5');
  assert.strictEqual(Paths.presence('4'), 'presence/4');
});
