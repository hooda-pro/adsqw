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

  const DB_VERSION = 2;
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
      req.onupgradeneeded = (ev) => {
        const d = req.result;
        const oldVersion = ev.oldVersion;
        if (!d.objectStoreNames.contains('messages')) {
          const s = d.createObjectStore('messages', { keyPath: '_k' });
          s.createIndex('convId', 'convId', { unique: false });
        }
        if (!d.objectStoreNames.contains('chats')) {
          d.createObjectStore('chats', { keyPath: 'id' });
        }
        // الإصدار 2: مخزن الـ hiddenFor (حذف عندي) + مخزن الـ profile
        if (oldVersion < 2) {
          if (!d.objectStoreNames.contains('hiddenFor')) {
            // المفتاح: convId/messageId — يخزن مين حذف الرسالة عنده
            d.createObjectStore('hiddenFor', { keyPath: '_k' });
          }
          if (!d.objectStoreNames.contains('profile')) {
            d.createObjectStore('profile', { keyPath: 'id' });
          }
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
      try {
        const t = d.transaction('messages', 'readwrite');
        const store = t.objectStore('messages');
        list.forEach((m) => store.put(Object.assign({ _k: convId + '/' + m.id, convId }, m)));
        await new Promise((r) => { t.oncomplete = r; t.onerror = r; t.onabort = r; });
      } catch (err) {
        console.warn('saveMessages failed:', err);
      }
    },

    /** كل الرسايل المخزّنة محليًا لمحادثة معيّنة، مرتّبة بالوقت */
    async getMessages(convId) {
      const d = await dbp;
      if (!d) return [];
      try {
        return await new Promise((resolve) => {
          const t = d.transaction('messages', 'readonly');
          const idx = t.objectStore('messages').index('convId');
          const req = idx.getAll(IDBKeyRange.only(convId));
          req.onsuccess = () => {
            const rows = (req.result || []).sort((a, b) => (a.ts || 0) - (b.ts || 0));
            resolve(rows);
          };
          req.onerror = () => resolve([]);
          t.onerror = () => resolve([]);
          t.onabort = () => resolve([]);
        });
      } catch (err) {
        console.warn('getMessages failed:', err);
        return [];
      }
    },

    /** بيانات قائمة الدردشات (آخر رسالة، الاسم، إلخ) — تحمّل فورًا وانت لسه لحظة فتح التطبيق */
    async saveChats(chatsArr) {
      const d = await dbp;
      if (!d || !chatsArr || !chatsArr.length) return;
      try {
        const t = d.transaction('chats', 'readwrite');
        const store = t.objectStore('chats');
        chatsArr.forEach((c) => store.put(c));
        await new Promise((r) => { t.oncomplete = r; t.onerror = r; t.onabort = r; });
      } catch (err) {
        console.warn('saveChats failed:', err);
      }
    },

    async getChats() {
      const d = await dbp;
      if (!d) return [];
      try {
        return await new Promise((resolve) => {
          const t = d.transaction('chats', 'readonly');
          const req = t.objectStore('chats').getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
          t.onerror = () => resolve([]);
          t.onabort = () => resolve([]);
        });
      } catch (err) {
        console.warn('getChats failed:', err);
        return [];
      }
    },

    /** حفظ البروفايل بتاعي محلياً — عشان القائمة تفتح فوراً حتى offline */
    async saveProfile(profile) {
      const d = await dbp;
      if (!d || !profile) return;
      try {
        const t = d.transaction('profile', 'readwrite');
        t.objectStore('profile').put(Object.assign({ id: 'me' }, profile));
        await new Promise((r) => { t.oncomplete = r; t.onerror = r; t.onabort = r; });
      } catch (err) {
        console.warn('saveProfile failed:', err);
      }
    },

    async getProfile() {
      const d = await dbp;
      if (!d) return null;
      try {
        return await new Promise((resolve) => {
          const t = d.transaction('profile', 'readonly');
          const req = t.objectStore('profile').get('me');
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
          t.onerror = () => resolve(null);
          t.onabort = () => resolve(null);
        });
      } catch (err) {
        console.warn('getProfile failed:', err);
        return null;
      }
    },

    /** حذف رسالة عندي (محلياً بس) — بتتسجل عشان لو رجعنا للرسالة من السيرفر نخفيها */
    async hideMessage(convId, messageId) {
      const d = await dbp;
      if (!d) return;
      try {
        const t = d.transaction('hiddenFor', 'readwrite');
        t.objectStore('hiddenFor').put({ _k: convId + '/' + messageId, convId, messageId });
        await new Promise((r) => { t.oncomplete = r; t.onerror = r; t.onabort = r; });
        // كمان بنمسح النسخة المخزنة نفسها عشان ما تظهرش في الـ render
        const t2 = d.transaction('messages', 'readwrite');
        t2.objectStore('messages').delete(convId + '/' + messageId);
        await new Promise((r) => { t2.oncomplete = r; t2.onerror = r; t2.onabort = r; });
      } catch (err) {
        console.warn('hideMessage failed:', err);
      }
    },

    /** بنجيب قائمة الرسايل اللي مخفيّة عندي في محادثة معيّنة */
    async getHiddenIds(convId) {
      const d = await dbp;
      if (!d) return new Set();
      try {
        return await new Promise((resolve) => {
          const t = d.transaction('hiddenFor', 'readonly');
          const req = t.objectStore('hiddenFor').getAll();
          req.onsuccess = () => {
            const ids = new Set();
            (req.result || []).forEach((row) => {
              if (row.convId === convId) ids.add(row.messageId);
            });
            resolve(ids);
          };
          req.onerror = () => resolve(new Set());
          t.onerror = () => resolve(new Set());
          t.onabort = () => resolve(new Set());
        });
      } catch (err) {
        console.warn('getHiddenIds failed:', err);
        return new Set();
      }
    },

    /** مسح كل رسايل محادثة معيّنة — بنستخدمها لما نحذف للجميع */
    async deleteConvMessages(convId) {
      const d = await dbp;
      if (!d) return;
      try {
        const t = d.transaction('messages', 'readwrite');
        const idx = t.objectStore('messages').index('convId');
        const req = idx.openCursor(IDBKeyRange.only(convId));
        req.onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
        await new Promise((r) => { t.oncomplete = r; t.onerror = r; t.onabort = r; });
      } catch (err) {
        console.warn('deleteConvMessages failed:', err);
      }
    },

    /** بتتنادى لما المستخدم يعمل تسجيل خروج — بتمسح نسخته المحلية بس، مش نسخة حد تاني */
    async wipe(uid) {
      try {
        if (dbp) {
          const d = await dbp;
          if (d) d.close();
        }
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
