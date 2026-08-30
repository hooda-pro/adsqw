// tests/format.test.js
// دوال العرض — بتتأكد إن التجميع والتواريخ والمعاينة والعدّادات بتطلع صح.
const test = require('node:test');
const assert = require('node:assert');
const Fmt = require('../public/js/format.js');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// وقت ثابت في نص اليوم عشان الاختبارات ماتتأثرش بالساعة اللي بنشغّل فيها
const NOON = new Date(2026, 3, 15, 12, 0, 0).getTime();

test('initials: أول حرف، ولو مفيش اسم علامة استفهام', () => {
  assert.strictEqual(Fmt.initials('أحمد'), 'أ');
  assert.strictEqual(Fmt.initials('  سارة '), 'س');
  assert.strictEqual(Fmt.initials('omar'), 'O');
  assert.strictEqual(Fmt.initials(''), '؟');
  assert.strictEqual(Fmt.initials(null), '؟');
});

test('isSameDay / startOfDay', () => {
  assert.ok(Fmt.isSameDay(NOON, NOON + HOUR));
  assert.ok(!Fmt.isSameDay(NOON, NOON + DAY));
  assert.strictEqual(Fmt.startOfDay(NOON), Fmt.startOfDay(NOON + 11 * HOUR));
  assert.ok(!Fmt.isSameDay(0, NOON));
});

test('chatListStamp: النهاردة وقت، أمس كلمة "أمس"، وأقدم من كده تاريخ', () => {
  assert.notStrictEqual(Fmt.chatListStamp(NOON - HOUR, NOON), '');
  assert.strictEqual(Fmt.chatListStamp(NOON - DAY, NOON), 'أمس');
  assert.strictEqual(Fmt.chatListStamp(0, NOON), '');
  const old = Fmt.chatListStamp(NOON - 30 * DAY, NOON);
  assert.ok(old.length > 0 && old !== 'أمس');
});

test('dayDivider: النهاردة / أمس', () => {
  assert.strictEqual(Fmt.dayDivider(NOON, NOON), 'النهاردة');
  assert.strictEqual(Fmt.dayDivider(NOON - DAY, NOON), 'أمس');
  assert.strictEqual(Fmt.dayDivider(0, NOON), '');
});

test('presenceText: متصل / آخر ظهور', () => {
  assert.strictEqual(Fmt.presenceText({ state: 'online' }, NOON), 'متصل الآن');
  assert.strictEqual(Fmt.presenceText(null, NOON), '');
  assert.strictEqual(Fmt.presenceText({ state: 'offline' }, NOON), 'غير متصل');
  assert.strictEqual(
    Fmt.presenceText({ state: 'offline', lastChanged: NOON - 30 * 1000 }, NOON),
    'آخر ظهور الآن'
  );
  assert.strictEqual(
    Fmt.presenceText({ state: 'offline', lastChanged: NOON - 5 * MIN }, NOON),
    'آخر ظهور قبل 5 دقيقة'
  );
  assert.ok(
    Fmt.presenceText({ state: 'offline', lastChanged: NOON - 5 * HOUR }, NOON).startsWith('آخر ظهور')
  );
});

test('buildTimeline: فاصل يوم واحد بس لكل يوم', () => {
  const msgs = [
    { senderId: '1', text: 'أ', ts: NOON - DAY },
    { senderId: '1', text: 'ب', ts: NOON - DAY + MIN },
    { senderId: '2', text: 'ج', ts: NOON },
  ];
  const items = Fmt.buildTimeline(msgs, '1', NOON);
  const dividers = items.filter((i) => i.kind === 'divider');
  assert.strictEqual(dividers.length, 2);
  assert.strictEqual(dividers[0].label, 'أمس');
  assert.strictEqual(dividers[1].label, 'النهاردة');
  assert.strictEqual(items.filter((i) => i.kind === 'message').length, 3);
});

test('buildTimeline: mine بيتحدد من senderId', () => {
  const msgs = [
    { senderId: '1', text: 'أنا', ts: NOON },
    { senderId: 2, text: 'هو', ts: NOON + MIN },
  ];
  const items = Fmt.buildTimeline(msgs, 1, NOON).filter((i) => i.kind === 'message');
  assert.strictEqual(items[0].mine, true);
  assert.strictEqual(items[1].mine, false);
});

test('buildTimeline: تجميع الرسايل المتتالية من نفس الشخص', () => {
  const msgs = [
    { senderId: '1', text: 'أ', ts: NOON },
    { senderId: '1', text: 'ب', ts: NOON + MIN },
    { senderId: '2', text: 'ج', ts: NOON + 2 * MIN },
  ];
  const items = Fmt.buildTimeline(msgs, '1', NOON).filter((i) => i.kind === 'message');
  assert.strictEqual(items[0].startsGroup, true, 'أول رسالة بعد الفاصل');
  assert.strictEqual(items[1].startsGroup, false, 'نفس الشخص وقريب في الوقت');
  assert.strictEqual(items[2].startsGroup, true, 'شخص تاني');
  assert.strictEqual(items[0].endsGroup, false);
  assert.strictEqual(items[1].endsGroup, true);
  assert.strictEqual(items[2].endsGroup, true);
});

test('buildTimeline: فرق أكتر من 5 دقايق يبدأ مجموعة جديدة', () => {
  const msgs = [
    { senderId: '1', text: 'أ', ts: NOON },
    { senderId: '1', text: 'ب', ts: NOON + 6 * MIN },
  ];
  const items = Fmt.buildTimeline(msgs, '1', NOON).filter((i) => i.kind === 'message');
  assert.strictEqual(items[1].startsGroup, true);
});

test('buildTimeline: قائمة فاضية بترجع فاضية', () => {
  assert.deepStrictEqual(Fmt.buildTimeline([], '1', NOON), []);
});

test('sortChats: الأحدث فوق، والأصل مايتغيرش', () => {
  const chats = [
    { id: 'a', lastAt: NOON - DAY },
    { id: 'b', lastAt: NOON },
    { id: 'c' }, // من غير lastAt — دردشة لسه فاضية
  ];
  const sorted = Fmt.sortChats(chats);
  assert.deepStrictEqual(sorted.map((c) => c.id), ['b', 'a', 'c']);
  assert.strictEqual(chats[0].id, 'a', 'sortChats مالهاش تأثير جانبي');
});

test('filterChats: بحث بالاسم', () => {
  const chats = [
    { otherName: 'أحمد', otherPhone: '01012345678' },
    { otherName: 'سارة', otherPhone: '01112345678' },
  ];
  assert.strictEqual(Fmt.filterChats(chats, 'أح').length, 1);
  assert.strictEqual(Fmt.filterChats(chats, 'أح')[0].otherName, 'أحمد');
  assert.strictEqual(Fmt.filterChats(chats, 'مفيش').length, 0);
});

test('filterChats: بحث بالرقم بيتجاهل المسافات والشرط', () => {
  const chats = [{ otherName: 'أحمد', otherPhone: '010 1234 5678' }];
  assert.strictEqual(Fmt.filterChats(chats, '0101234').length, 1);
  assert.strictEqual(Fmt.filterChats(chats, '010-1234').length, 1);
  assert.strictEqual(Fmt.filterChats(chats, '0999').length, 0);
});

test('filterChats: استعلام فاضي بيرجّع كل الدردشات', () => {
  const chats = [{ otherName: 'أحمد' }, { otherName: 'سارة' }];
  assert.strictEqual(Fmt.filterChats(chats, '').length, 2);
  assert.strictEqual(Fmt.filterChats(chats, '   ').length, 2);
  assert.strictEqual(Fmt.filterChats(chats, null).length, 2);
});

test('previewText: "أنت:" لما تكون آخر رسالة مني', () => {
  assert.strictEqual(Fmt.previewText({ lastMessage: 'سلام', lastSenderId: '1' }, '1'), 'أنت: سلام');
  assert.strictEqual(Fmt.previewText({ lastMessage: 'سلام', lastSenderId: '2' }, '1'), 'سلام');
  assert.strictEqual(Fmt.previewText({ lastMessage: 'سلام', lastSenderId: 1 }, '1'), 'أنت: سلام');
});

test('previewText: دردشة جديدة من غير رسايل', () => {
  assert.strictEqual(Fmt.previewText({}, '1'), 'ابدأ المحادثة');
  assert.strictEqual(Fmt.previewText({ lastMessage: '   ' }, '1'), 'ابدأ المحادثة');
});

test('previewText: الأسطر الجديدة بتبقى مسافة، والنص الطويل بيتقص', () => {
  assert.strictEqual(Fmt.previewText({ lastMessage: 'سطر\nتاني' }, '1'), 'سطر تاني');
  const long = 'ا'.repeat(200);
  const out = Fmt.previewText({ lastMessage: long }, '1');
  assert.strictEqual(out.length, 48);
  assert.ok(out.endsWith('…'));
  assert.ok(!out.includes('\n'));
});

test('messageStatus: pending / sent / read', () => {
  assert.strictEqual(Fmt.messageStatus({ text: 'أ' }, 0), 'pending');
  assert.strictEqual(Fmt.messageStatus(null, 0), 'pending');
  assert.strictEqual(Fmt.messageStatus({ ts: NOON }, 0), 'sent');
  assert.strictEqual(Fmt.messageStatus({ ts: NOON }, NOON - MIN), 'sent');
  assert.strictEqual(Fmt.messageStatus({ ts: NOON }, NOON), 'read');
  assert.strictEqual(Fmt.messageStatus({ ts: NOON }, NOON + MIN), 'read');
});

test('unreadCount: رسايلي أنا مش بتتحسب', () => {
  assert.strictEqual(Fmt.unreadCount({ lastAt: NOON, lastSenderId: '1', unread: 5 }, '1'), 0);
  assert.strictEqual(Fmt.unreadCount({ lastAt: NOON, lastSenderId: '2', unread: 5 }, '1'), 5);
});

test('unreadCount: بعد ما أقرأ بيرجع صفر', () => {
  const chat = { lastAt: NOON, lastSenderId: '2', unread: 3 };
  assert.strictEqual(Fmt.unreadCount({ ...chat, myReadAt: NOON }, '1'), 0);
  assert.strictEqual(Fmt.unreadCount({ ...chat, myReadAt: NOON - MIN }, '1'), 3);
});

test('unreadCount: حالات ناقصة', () => {
  assert.strictEqual(Fmt.unreadCount(null, '1'), 0);
  assert.strictEqual(Fmt.unreadCount({}, '1'), 0);
  // فيه رسالة جديدة بس العدّاد لسه ماوصلش — نعرض 1 على الأقل
  assert.strictEqual(Fmt.unreadCount({ lastAt: NOON, lastSenderId: '2' }, '1'), 1);
});
