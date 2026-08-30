// public/js/format.js
// دوال عرض خالصة (مالهاش أي علاقة بالـ DOM) — قابلة للاختبار من Node مباشرة.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MalgFormat = factory();
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  /** الحرف اللي يظهر في الأفاتار */
  function initials(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return '؟';
    return trimmed.charAt(0).toUpperCase();
  }

  /** ساعة:دقيقة بالعربي المصري */
  function timeOfDay(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }

  /** بداية اليوم بالتوقيت المحلي — أساس مقارنة "نفس اليوم" */
  function startOfDay(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  /** هل التاريختين في نفس اليوم المحلي؟ */
  function isSameDay(a, b) {
    if (!a || !b) return false;
    return startOfDay(a) === startOfDay(b);
  }

  /** الوقت اللي بيظهر جنب الدردشة في القائمة: النهاردة ساعة، أمس "أمس"، أقدم تاريخ */
  function chatListStamp(ts, now = Date.now()) {
    if (!ts) return '';
    if (isSameDay(ts, now)) return timeOfDay(ts);
    if (isSameDay(ts, now - DAY)) return 'أمس';
    const diffDays = Math.round((startOfDay(now) - startOfDay(ts)) / DAY);
    if (diffDays < 7) return new Date(ts).toLocaleDateString('ar-EG', { weekday: 'long' });
    return new Date(ts).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit' });
  }

  /** الفاصل اللي بيتحط بين رسائل الأيام المختلفة جوه الشات */
  function dayDivider(ts, now = Date.now()) {
    if (!ts) return '';
    if (isSameDay(ts, now)) return 'النهاردة';
    if (isSameDay(ts, now - DAY)) return 'أمس';
    return new Date(ts).toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: isSameDay(startOfDay(ts), startOfDay(now)) ? undefined : 'numeric',
    });
  }

  /** نص حالة التواجد: "متصل الآن" أو "آخر ظهور ..." */
  function presenceText(presence, now = Date.now()) {
    if (!presence) return '';
    if (presence.state === 'online') return 'متصل الآن';
    const last = presence.lastChanged;
    if (!last) return 'غير متصل';
    const diff = now - last;
    if (diff < MINUTE) return 'آخر ظهور الآن';
    if (diff < HOUR) return `آخر ظهور قبل ${Math.floor(diff / MINUTE)} دقيقة`;
    if (isSameDay(last, now)) return `آخر ظهور ${timeOfDay(last)}`;
    if (isSameDay(last, now - DAY)) return `آخر ظهور أمس ${timeOfDay(last)}`;
    return `آخر ظهور ${new Date(last).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit' })}`;
  }

  /**
   * بيحوّل رسائل مرتّبة لعناصر عرض: فواصل أيام + هل الرسالة أول واحدة في مجموعة
   * (عشان الأفاتار/الذيل يظهر مرة واحدة بس لكل مجموعة رسائل متتالية من نفس الشخص).
   */
  function buildTimeline(messages, myId, now = Date.now()) {
    const items = [];
    let prev = null;
    for (const m of messages) {
      const mine = String(m.senderId) === String(myId);
      if (!prev || !isSameDay(prev.ts, m.ts)) {
        items.push({ kind: 'divider', label: dayDivider(m.ts, now) });
        prev = null;
      }
      const sameSender = prev && String(prev.senderId) === String(m.senderId);
      const closeInTime = prev && Math.abs((m.ts || 0) - (prev.ts || 0)) < 5 * MINUTE;
      items.push({
        kind: 'message',
        message: m,
        mine,
        startsGroup: !(sameSender && closeInTime),
      });
      prev = m;
    }
    // آخر رسالة في كل مجموعة هي اللي بتحمل الذيل
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind !== 'message') continue;
      const next = items[i + 1];
      it.endsGroup = !next || next.kind !== 'message' || next.startsGroup;
    }
    return items;
  }

  /** بيرتّب الدردشات: الأحدث فوق */
  function sortChats(chats) {
    return [...chats].sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
  }

  /** فلترة قائمة الدردشات بالاسم أو الرقم (بحث محلي في دردشاتك إنت بس) */
  function filterChats(chats, query) {
    const q = String(query || '').trim();
    if (!q) return chats;
    const digits = q.replace(/\D/g, '');
    return chats.filter((c) => {
      const nameHit = String(c.otherName || '').includes(q);
      const phoneHit = digits.length > 0 && String(c.otherPhone || '').replace(/\D/g, '').includes(digits);
      return nameHit || phoneHit;
    });
  }

  /** معاينة آخر رسالة في القائمة، مقصوصة ومن غير أسطر جديدة */
  function previewText(chat, myId) {
    const raw = String(chat.lastMessage || '').replace(/\s+/g, ' ').trim();
    if (!raw) return 'ابدأ المحادثة';
    const mine = chat.lastSenderId !== undefined && String(chat.lastSenderId) === String(myId);
    const body = raw.length > 48 ? raw.slice(0, 47) + '…' : raw;
    return mine ? 'أنت: ' + body : body;
  }

  /** حالة رسالتي: اتبعتت / اتقرأت */
  function messageStatus(message, otherReadAt) {
    if (!message || !message.ts) return 'pending';
    return otherReadAt && otherReadAt >= message.ts ? 'read' : 'sent';
  }

  /** عدد الرسايل الجديدة اللي مقريتهاش في دردشة */
  function unreadCount(chat, myId) {
    if (!chat) return 0;
    const lastAt = chat.lastAt || 0;
    if (!lastAt) return 0;
    if (chat.lastSenderId !== undefined && String(chat.lastSenderId) === String(myId)) return 0;
    const seen = chat.myReadAt || 0;
    return lastAt > seen ? chat.unread || 1 : 0;
  }

  return {
    initials,
    timeOfDay,
    startOfDay,
    isSameDay,
    chatListStamp,
    dayDivider,
    presenceText,
    buildTimeline,
    sortChats,
    filterChats,
    previewText,
    messageStatus,
    unreadCount,
  };
});
