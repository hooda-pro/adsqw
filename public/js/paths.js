// public/js/paths.js
// مسارات Firebase Realtime Database في مكان واحد.
// أي تغيير في شكل الشجرة لازم يتغيّر هنا وفي firebase-database-rules.json مع بعض.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MalgPaths = factory();
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /**
   * id ثابت للمحادثة بين أي شخصين — نفس القيمة عند الطرفين مهما مين فتحها الأول.
   * الترتيب أبجدي على النص، فالمهم إنه متسق عند الاتنين (مش الترتيب الرقمي).
   */
  function conversationId(a, b) {
    const ids = [String(a), String(b)].sort();
    return ids[0] + '_' + ids[1];
  }

  const paths = {
    conversationId,
    conversation: (convId) => `conversations/${convId}`,
    participants: (convId) => `conversations/${convId}/participants`,
    messages: (convId) => `conversations/${convId}/messages`,
    message: (convId, messageId) => `conversations/${convId}/messages/${messageId}`,
    deletedMessages: (convId) => `conversations/${convId}/deletedMessages`,
    deletedMessage: (convId, messageId) => `conversations/${convId}/deletedMessages/${messageId}`,
    typing: (convId, uid) => `conversations/${convId}/typing/${uid}`,
    typingRoot: (convId) => `conversations/${convId}/typing`,
    reads: (convId, uid) => `conversations/${convId}/reads/${uid}`,
    readsRoot: (convId) => `conversations/${convId}/reads`,
    userChats: (uid) => `userConversations/${uid}`,
    userChat: (uid, otherUid) => `userConversations/${uid}/${otherUid}`,
    presence: (uid) => `presence/${uid}`,
    blocks: (uid) => `blocks/${uid}`,
    blockedUser: (uid, otherUid) => `blocks/${uid}/${otherUid}`,
  };

  return paths;
});
