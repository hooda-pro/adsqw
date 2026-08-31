// public/js/store.js
// ============================================================
// تخزين محلي على جهاز المستخدم (IndexedDB) — مش على أي سيرفر.
// الفكرة زي واتساب بالظبط: تاريخ الشات بيتخزن على التليفون/الكمبيوتر
// بتاعك انت، مش عند حد تاني. الأونلاين (Firebase) بيستخدم كـ"ساعي بريد"
// بس عشان يوصّل الرسالة للطرف التاني وهو أونلاين — مش مكان تخزين دائم.
//
// كل مستخدم ليه قاعدة بيانات منفصلة على جهازه (اسمها فيه رقمه) عشان لو
// أكتر من حساب سجل دخول على نفس المتصفح ميتلخبطوش في بعض.
// ============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MalgStore = factory();
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const DB_VERSION = 1;
  let dbp = null; // promise بترجع الاتصال بالـ IndexedDB
  let dbName = null;

  function open(uid) {
    dbName = 'malg_' + String(uid);
    if (dbp) return dbp;
    if (typeof indexedDB === 'undefined') {
      // متصفح قديم جدًا أو وضع خاص بيمنع IndexedDB — التطبيق يفضل شغال
      // عادي، بس من غير كاش محلي (هيرجع يجيب كل حاجة من Firebase بس).
      dbp = Promise.resolve(null);
      return dbp;
    }
    dbp = new Promise((resolve) => {
      const req = indexedDB.open(dbName, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('messages')) {
          const s = d.createObjectStore('messages', { keyPath: '_k' });
          s.createIndex('convId', 'convId', { unique: false });
        }
        if (!d.objectStoreNames.contains('chats')) {
          d.createObjectStore('chats', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { console.warn('IndexedDB مش شغالة، هنكمّل من غير كاش محلي'); resolve(null); };
    });
    return dbp;
  }

  function tx(d, store, mode) {
    return d.transaction(store, mode).objectStore(store);
  }

  return {
    /** لازم تتنادى مرة واحدة بعد تسجيل الدخول، قبل أي حاجة تانية */
    init(uid) { return open(uid); },

    /** بتضيف/تحدّث مجموعة رسايل لمحادثة معيّنة (مايمسحش القديم) */
    async saveMessages(convId, list) {
      const d = await dbp;
      if (!d || !list || !list.length) return;
      const store = tx(d, 'messages', 'readwrite');
      list.forEach((m) => store.put(Object.assign({ _k: convId + '/' + m.id, convId }, m)));
    },

    /** كل الرسايل المخزّنة محليًا لمحادثة معيّنة، مرتّبة بالوقت */
    async getMessages(convId) {
      const d = await dbp;
      if (!d) return [];
      return new Promise((resolve) => {
        const idx = tx(d, 'messages', 'readonly').index('convId');
        const req = idx.getAll(IDBKeyRange.only(convId));
        req.onsuccess = () => {
          const rows = (req.result || []).sort((a, b) => (a.ts || 0) - (b.ts || 0));
          resolve(rows);
        };
        req.onerror = () => resolve([]);
      });
    },

    /** بيانات قائمة الدردشات (آخر رسالة، الاسم، إلخ) — تحمّل فورًا وانت لسه لحظة فتح التطبيق */
    async saveChats(chatsArr) {
      const d = await dbp;
      if (!d || !chatsArr || !chatsArr.length) return;
      const store = tx(d, 'chats', 'readwrite');
      chatsArr.forEach((c) => store.put(c));
    },

    async getChats() {
      const d = await dbp;
      if (!d) return [];
      return new Promise((resolve) => {
        const req = tx(d, 'chats', 'readonly').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    },

    /** بتتنادى لما المستخدم يعمل تسجيل خروج — بتمسح نسخته المحلية بس، مش نسخة حد تاني */
    async wipe(uid) {
      try {
        if (dbp) { const d = await dbp; if (d) d.close(); }
      } catch (_) { /* تجاهل */ }
      dbp = null;
      return new Promise((resolve) => {
        const req = indexedDB.deleteDatabase('malg_' + String(uid));
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    },
  };
});
