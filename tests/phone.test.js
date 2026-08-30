// tests/phone.test.js
// اختبارات منطق أرقام الهاتف — أهم ملف في الخصوصية، لأنه هو اللي بيحدد
// إمتى الرقم "كامل" وبنبحث بيه، وإمتى بنرفض.
const test = require('node:test');
const assert = require('node:assert');
const Phone = require('../lib/phone');

test('canonicalPhone: كل صيغ الرقم المصري بترجع لنفس الشكل', () => {
  const expected = '01012345678';
  const inputs = [
    '01012345678',
    '010 1234 5678',
    '010-1234-5678',
    '+201012345678',
    '00201012345678',
    '201012345678',
    ' 0101 234 5678 ',
  ];
  for (const input of inputs) {
    assert.strictEqual(Phone.canonicalPhone(input), expected, 'فشل مع: ' + input);
  }
});

test('canonicalPhone: كل بادئات الموبايل المصرية مقبولة', () => {
  for (const prefix of Phone.EG_MOBILE_PREFIXES) {
    const num = '0' + prefix + '12345678';
    assert.strictEqual(num.length, 11);
    assert.strictEqual(Phone.canonicalPhone(num), num, 'فشل مع البادئة: ' + prefix);
  }
});

test('canonicalPhone: بادئة مش موجودة بترفض', () => {
  assert.strictEqual(Phone.canonicalPhone('01312345678'), '');
  assert.strictEqual(Phone.canonicalPhone('01912345678'), '');
});

test('canonicalPhone: الأرقام الناقصة بترفض — ده أساس الخصوصية', () => {
  const partials = ['0', '01', '010', '0101', '01012', '0101234', '010123456', '0101234567'];
  for (const p of partials) {
    assert.strictEqual(Phone.canonicalPhone(p), '', 'المفروض يترفض: ' + p);
    assert.strictEqual(Phone.isValidPhone(p), false, 'المفروض يترفض: ' + p);
  }
});

test('canonicalPhone: رقم أطول من اللازم بيترفض', () => {
  assert.strictEqual(Phone.canonicalPhone('010123456789'), '');
  assert.strictEqual(Phone.canonicalPhone('0101234567890'), '');
});

test('canonicalPhone: مدخلات فاضية أو مش نص', () => {
  assert.strictEqual(Phone.canonicalPhone(''), '');
  assert.strictEqual(Phone.canonicalPhone(null), '');
  assert.strictEqual(Phone.canonicalPhone(undefined), '');
  assert.strictEqual(Phone.canonicalPhone('   '), '');
  assert.strictEqual(Phone.canonicalPhone('مش رقم'), '');
});

test('canonicalPhone: رقم دولي لازم يكون مكتوب بـ + أو 00', () => {
  assert.strictEqual(Phone.canonicalPhone('+9715012345678'), '+9715012345678');
  assert.strictEqual(Phone.canonicalPhone('009715012345678'), '+9715012345678');
  // من غير + مايتحسبش دولي (عشان منخلطش بينه وبين رقم محلي ناقص)
  assert.strictEqual(Phone.canonicalPhone('9715012345678'), '');
});

test('phoneVariants: بترجّع كل الصيغ اللي ممكن الرقم يكون متخزّن بيها', () => {
  const variants = Phone.phoneVariants('01012345678');
  assert.ok(variants.includes('01012345678'));
  assert.ok(variants.includes('201012345678'));
  assert.ok(variants.includes('+201012345678'));
  assert.ok(variants.includes('00201012345678'));
  assert.strictEqual(new Set(variants).size, variants.length, 'مفيش تكرار');
});

test('phoneVariants: أي صيغة من نفس الرقم بتطلّع نفس القايمة', () => {
  const a = Phone.phoneVariants('01012345678').sort();
  const b = Phone.phoneVariants('+20 101 234 5678').sort();
  assert.deepStrictEqual(a, b);
});

test('phoneVariants: رقم ناقص بيرجّع قايمة فاضية — يعني الاستعلام ماينفعش يلاقي حد', () => {
  assert.deepStrictEqual(Phone.phoneVariants('010'), []);
  assert.deepStrictEqual(Phone.phoneVariants(''), []);
  assert.deepStrictEqual(Phone.phoneVariants('0101234'), []);
});

test('phoneVariants: مفيش أي رمز بحث جزئي (% أو _) في أي صيغة', () => {
  for (const v of Phone.phoneVariants('01012345678')) {
    assert.ok(!v.includes('%'), 'مفيش % في: ' + v);
    assert.ok(!v.includes('_'), 'مفيش _ في: ' + v);
    assert.match(v, /^\+?[0-9]+$/);
  }
});

test('phoneError: رسائل واضحة ومتسقة', () => {
  assert.strictEqual(Phone.phoneError(''), 'اكتب رقم الهاتف');
  assert.strictEqual(Phone.phoneError('010'), 'الرقم ناقص — لازم تكتب الرقم بالكامل (11 رقم)');
  assert.strictEqual(Phone.phoneError('01012345678'), '');
  assert.strictEqual(Phone.phoneError('01312345678'), 'الرقم ده مش صحيح — تأكد إنه رقم موبايل مكتوب صح');
});

test('formatPhoneForDisplay: شكل ودّي للرقم المصري', () => {
  assert.strictEqual(Phone.formatPhoneForDisplay('01012345678'), '010 1234 5678');
  assert.strictEqual(Phone.formatPhoneForDisplay('+201012345678'), '010 1234 5678');
});
