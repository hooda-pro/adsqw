// public/js/phone.js
// ============================================================
// المصدر الوحيد لمنطق أرقام الهاتف — بيستخدمه المتصفح والسيرفر مع بعض.
//   - المتصفح: <script src="/js/phone.js"> ➜ window.MalgPhone
//   - السيرفر:  require('../lib/phone') ➜ نفس الملف بالظبط
// أي تعديل هنا بيسري على الاتنين في نفس الوقت (مفيش نسختين تفرقوا عن بعض).
// ============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MalgPhone = factory();
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  // بادئات الموبايل المصري الصالحة (بعد الصفر)
  const EG_MOBILE_PREFIXES = ['10', '11', '12', '15'];
  const EG_COUNTRY_CODE = '20';

  // أقصى/أدنى طول معقول لرقم دولي (E.164)
  const MIN_INTL_DIGITS = 8;
  const MAX_INTL_DIGITS = 15;

  /** بيسيب الأرقام بس (مع + في الأول لو موجودة). ده أول تنضيف لأي إدخال. */
  function stripToDigits(input) {
    if (input === null || input === undefined) return '';
    const raw = String(input).trim();
    const hasPlus = raw.startsWith('+') || raw.startsWith('00');
    const digits = raw.replace(/\D/g, '').replace(/^00/, '');
    return hasPlus ? '+' + digits : digits;
  }

  /** هل الأرقام دي موبايل مصري بصيغة محلية (01XXXXXXXXX)؟ */
  function isEgyptianLocal(digits) {
    return (
      digits.length === 11 &&
      digits.startsWith('0') &&
      EG_MOBILE_PREFIXES.includes(digits.slice(1, 3))
    );
  }

  /** هل الأرقام دي موبايل مصري بصيغة دولية (201XXXXXXXXX)؟ */
  function isEgyptianIntl(digits) {
    return (
      digits.length === 12 &&
      digits.startsWith(EG_COUNTRY_CODE) &&
      EG_MOBILE_PREFIXES.includes(digits.slice(2, 4))
    );
  }

  /**
   * بيحوّل أي صيغة لرقم واحد قياسي (canonical) نخزّنه ونقارن بيه:
   *   01012345678 / +201012345678 / 0020 10 1234 5678 / 201012345678  ➜  01012345678
   * الأرقام غير المصرية بتترجع بصيغة +دولية.
   * بيرجّع '' لو الرقم مش صالح خالص.
   */
  function canonicalPhone(input) {
    const cleaned = stripToDigits(input);
    const digits = cleaned.replace(/^\+/, '');
    if (!digits) return '';

    if (isEgyptianLocal(digits)) return digits;
    if (isEgyptianIntl(digits)) return '0' + digits.slice(2);

    // رقم دولي تاني: لازم يكون مكتوب بـ + أو 00 عشان منخلطش بينه وبين رقم محلي ناقص
    if (
      cleaned.startsWith('+') &&
      digits.length >= MIN_INTL_DIGITS &&
      digits.length <= MAX_INTL_DIGITS
    ) {
      return '+' + digits;
    }

    return '';
  }

  /** هل الإدخال ده رقم كامل صالح نقدر نبحث/نسجّل بيه؟ */
  function isValidPhone(input) {
    return canonicalPhone(input) !== '';
  }

  /**
   * كل الصيغ اللي ممكن يكون الرقم متخزّن بيها في قاعدة البيانات من نسخ قديمة
   * من الكود (اللي كانت بتخزّن اللي المستخدم كتبه زي ما هو بعد شيل الرموز).
   * البحث بيقارن بالقايمة دي بالتساوي التام — مفيش LIKE ولا بحث جزئي.
   */
  function phoneVariants(input) {
    const canonical = canonicalPhone(input);
    if (!canonical) return [];

    const variants = new Set([canonical]);
    if (canonical.startsWith('0')) {
      const national = canonical.slice(1); // 1012345678
      variants.add(EG_COUNTRY_CODE + national); // 201012345678
      variants.add('+' + EG_COUNTRY_CODE + national); // +201012345678
      variants.add('00' + EG_COUNTRY_CODE + national); // 00201012345678
    } else if (canonical.startsWith('+')) {
      variants.add(canonical.slice(1));
      variants.add('00' + canonical.slice(1));
    }
    return Array.from(variants);
  }

  /** شكل ودّي للعرض: 010 1234 5678 */
  function formatPhoneForDisplay(input) {
    const canonical = canonicalPhone(input) || stripToDigits(input);
    if (isEgyptianLocal(canonical)) {
      return canonical.slice(0, 3) + ' ' + canonical.slice(3, 7) + ' ' + canonical.slice(7);
    }
    return canonical;
  }

  /**
   * رسالة الخطأ المناسبة لإدخال ناقص/غلط — مستخدمة في الواجهة والسيرفر بنفس النص
   * عشان المستخدم يشوف نفس الكلام في الحالتين.
   */
  function phoneError(input) {
    const digits = stripToDigits(input).replace(/^\+/, '');
    if (!digits) return 'اكتب رقم الهاتف';
    if (digits.length < 11) return 'الرقم ناقص — لازم تكتب الرقم بالكامل (11 رقم)';
    if (isValidPhone(input)) return '';
    return 'الرقم ده مش صحيح — تأكد إنه رقم موبايل مكتوب صح';
  }

  return {
    EG_MOBILE_PREFIXES,
    stripToDigits,
    isEgyptianLocal,
    isEgyptianIntl,
    canonicalPhone,
    isValidPhone,
    phoneVariants,
    formatPhoneForDisplay,
    phoneError,
  };
});
