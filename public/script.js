// script.js
const SUPPORT_WHATSAPP_NUMBER = '201065749774'; // بصيغة دولية (مصر: 20 بدل الصفر الأول)

// ---------- عناصر الصفحة ----------
const authShell = document.getElementById('authShell');
const appShell = document.getElementById('appShell');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const tabs = document.querySelectorAll('.tab');
const forms = document.querySelectorAll('.form');

const searchToggleBtn = document.getElementById('searchToggleBtn');
const searchBar = document.getElementById('searchBar');
const chatSearchInput = document.getElementById('chatSearchInput');
const chatList = document.getElementById('chatList');
const emptyChats = document.getElementById('emptyChats');
const logoutBtn = document.getElementById('logoutBtn');

const newChatFab = document.getElementById('newChatFab');
const newChatModal = document.getElementById('newChatModal');
const newChatClose = document.getElementById('newChatClose');
const newChatSearch = document.getElementById('newChatSearch');
const searchResults = document.getElementById('searchResults');

const chatScreen = document.getElementById('chatScreen');
const backBtn = document.getElementById('backBtn');
const chatAvatar = document.getElementById('chatAvatar');
const chatName = document.getElementById('chatName');
const messagesList = document.getElementById('messagesList');
const composerForm = document.getElementById('composerForm');
const composerInput = document.getElementById('composerInput');

const forgotBtn = document.getElementById('forgotBtn');
const forgotModal = document.getElementById('forgotModal');
const forgotCancel = document.getElementById('forgotCancel');
const forgotWhatsapp = document.getElementById('forgotWhatsapp');
const forgotPhone = document.getElementById('forgotPhone');

let currentUser = null;
let activeChatId = null; // id بتاع الشخص التاني في الدردشة المفتوحة دلوقتي
let activeChat = null; // نفس بيانات الشخص التاني (اسم/رقم) عشان نستخدمها وقت البعت
let currentChatsCache = []; // آخر نسخة من قائمة الدردشات جايه من Firebase (عشان الفلترة بالبحث)

// ============================================================
// تبديل التابات (دخول / حساب جديد)
// ============================================================
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    forms.forEach((f) => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}Form`).classList.add('active');
  });
});

// ============================================================
// تسجيل الدخول
// ============================================================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';

  const phone = document.getElementById('loginPhone').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'حصل خطأ';
      return;
    }

    saveSession(data.token, data.user);
    enterApp(data.user);
  } catch (err) {
    errorEl.textContent = 'مقدرش أتواصل مع السيرفر، جرب تاني';
  }
});

// ============================================================
// حساب جديد
// ============================================================
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('signupError');
  errorEl.textContent = '';

  const name = document.getElementById('signupName').value;
  const phone = document.getElementById('signupPhone').value;
  const password = document.getElementById('signupPassword').value;

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'حصل خطأ';
      return;
    }

    saveSession(data.token, data.user);
    enterApp(data.user);
  } catch (err) {
    errorEl.textContent = 'مقدرش أتواصل مع السيرفر، جرب تاني';
  }
});

// ============================================================
// نسيت الباسورد
// ============================================================
forgotBtn.addEventListener('click', () => { forgotModal.hidden = false; });
forgotCancel.addEventListener('click', () => { forgotModal.hidden = true; });
forgotPhone.addEventListener('input', updateForgotLink);
function updateForgotLink() {
  const phone = forgotPhone.value.trim();
  const msg = encodeURIComponent(`مرحباً، نسيت كلمة السر لحسابي في Malg. رقمي المسجل: ${phone || '.....'}`);
  forgotWhatsapp.href = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${msg}`;
}
updateForgotLink();

// ============================================================
// الجلسة
// ============================================================
function saveSession(token, user) {
  localStorage.setItem('malg_token', token);
  localStorage.setItem('malg_user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('malg_token');
  localStorage.removeItem('malg_user');
}
function getToken() {
  return localStorage.getItem('malg_token');
}

// الانتقال من شاشة الدخول للشاشة الرئيسية بحركة سلسة
function enterApp(user) {
  currentUser = user;
  authShell.classList.add('leaving');
  setTimeout(() => {
    authShell.hidden = true;
    authShell.classList.remove('leaving');
    appShell.hidden = false;
    document.getElementById('meName').textContent = user.name;
    document.getElementById('mePhone').textContent = user.phone;
    document.getElementById('meAvatar').textContent = (user.name || '?').charAt(0).toUpperCase();
    signIntoFirebase();
  }, 320);
}

logoutBtn.addEventListener('click', () => {
  stopChatListListener();
  stopMessagesListener();
  if (fbAuth) fbAuth.signOut().catch(() => {});
  clearSession();
  location.reload();
});

// التحقق من الجلسة عند فتح الصفحة (من غير أنيميشن، دخول مباشر)
(async function checkSession() {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();

    if (res.ok) {
      currentUser = data.user;
      authShell.hidden = true;
      appShell.hidden = false;
      document.getElementById('meName').textContent = data.user.name;
      document.getElementById('mePhone').textContent = data.user.phone;
      document.getElementById('meAvatar').textContent = (data.user.name || '?').charAt(0).toUpperCase();
      signIntoFirebase();
    } else {
      clearSession();
    }
  } catch (err) {
    // مفيش نت أو السيرفر واقع - سيب المستخدم في شاشة الدخول
  }
})();

// ============================================================
// بحث/إخفاء شريط البحث في قائمة الدردشات
// ============================================================
searchToggleBtn.addEventListener('click', () => {
  searchBar.hidden = !searchBar.hidden;
  if (!searchBar.hidden) chatSearchInput.focus();
  else chatSearchInput.value = '', renderChatList(currentChatsCache);
});
chatSearchInput.addEventListener('input', () => renderChatList(currentChatsCache, chatSearchInput.value.trim()));

// ============================================================
// Firebase — تسجيل الدخول والرسائل الفورية (Realtime Database)
// ============================================================
let fbApp = null;
let fbAuth = null;
let fbDb = null;
let chatListRef = null; // مرجع الاستماع لقائمة الدردشات
let messagesRef = null; // مرجع الاستماع لرسائل الشات المفتوح دلوقتي

function initFirebase() {
  if (fbApp) return;
  fbApp = firebase.initializeApp(window.FIREBASE_CONFIG);
  fbAuth = firebase.auth();
  fbDb = firebase.database();
}

// شريط تحذير صغير بيظهر فوق الصفحة لو الرسائل الفورية معندهاش اتصال —
// قبل كده كان الخطأ ده بيتكتب في الـ console بس ومحدش كان حاسس إن فيه مشكلة أصلاً.
function showConnIssueBanner(msg) {
  let el = document.getElementById('connIssueBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'connIssueBanner';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#c1552e;color:#f4e9d8;text-align:center;padding:8px 14px;font-size:13px;line-height:1.4;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.hidden = false;
}
function hideConnIssueBanner() {
  const el = document.getElementById('connIssueBanner');
  if (el) el.hidden = true;
}

// بتتنادى بعد نجاح تسجيل الدخول/الحساب الجديد أو استعادة الجلسة
async function signIntoFirebase() {
  try {
    initFirebase();
    const res = await fetch('/api/firebase-token', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'firebase token error');

    await fbAuth.signInWithCustomToken(data.firebaseToken);
    hideConnIssueBanner();
    listenToChatList();
    // لو كان فيه محادثة مفتوحة وقت ما الاتصال اتقطع، رجّع الاستماع لرسائلها كمان
    if (activeChatId) listenToMessages(activeChatId);
  } catch (err) {
    console.error('مقدرش أسجل دخول على Firebase (الرسائل الفورية):', err);
    showConnIssueBanner('في مشكلة في الاتصال بالرسائل الفورية — جرب تسجّل خروج ودخول تاني، أو حدّث الصفحة');
  }
}

// لو أي استماع (قائمة الدردشات أو الرسائل) اتقفل بغتة، بنحاول نصلح الاتصال بصمت
// مرة واحدة الأول (زي ما بيحصل طبيعي لو التوكن قدم شوية) قبل ما نزعج المستخدم بتحذير.
// من غير الحماية دي، أي قطعة اتصال عابرة كانت بتوقف تحديث قائمة الدردشات للأبد
// لحد ما المستخدم يحدّث الصفحة بنفسه.
let reconnectAttemptedAt = 0;
function tryReconnectFirebase(sourceLabel) {
  const now = Date.now();
  if (now - reconnectAttemptedAt < 4000) return; // منع محاولات متكررة في ثواني معدودة
  reconnectAttemptedAt = now;
  console.warn(`إعادة محاولة الاتصال بعد فشل الاستماع (${sourceLabel})`);
  signIntoFirebase();
}

// id ثابت للمحادثة بين أي شخصين (نفس القيمة عند الاتنين مهما مين فتحها الأول)
function conversationId(a, b) {
  const ids = [String(a), String(b)].sort();
  return `${ids[0]}_${ids[1]}`;
}

function stopChatListListener() {
  if (chatListRef) { chatListRef.off(); chatListRef = null; }
}
function stopMessagesListener() {
  if (messagesRef) { messagesRef.off(); messagesRef = null; }
}

// استماع مباشر لقائمة دردشات المستخدم (بتتحدث فورياً لو حد بعتله رسالة جديدة حتى لو أول مرة)
function listenToChatList() {
  stopChatListListener();
  chatListRef = fbDb.ref(`userConversations/${currentUser.id}`);
  chatListRef.on(
    'value',
    (snap) => {
      hideConnIssueBanner();
      const data = snap.val() || {};
      const chats = Object.keys(data).map((otherId) => ({ id: otherId, ...data[otherId] }));
      renderChatList(chats);
    },
    (err) => {
      console.error('فشل الاستماع لقائمة الدردشات:', err);
      tryReconnectFirebase('قائمة الدردشات');
    }
  );
}

// ============================================================
// تخزين محلي بسيط لآخر بيانات معروضة (عشان الفلترة أثناء الكتابة في البحث)
// ============================================================
function renderChatList(chats, filter = '') {
  currentChatsCache = chats;
  const sorted = [...chats].sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
  const filtered = filter
    ? sorted.filter((c) => (c.otherName || '').includes(filter) || (c.otherPhone || '').includes(filter))
    : sorted;

  chatList.innerHTML = '';
  emptyChats.hidden = chats.length > 0;

  filtered.forEach((chat, index) => {
    const item = document.createElement('div');
    item.className = 'chat-item';
    item.style.animationDelay = `${index * 40}ms`;

    const preview = chat.lastMessage || 'ابدأ المحادثة';
    const time = chat.lastAt ? formatTime(chat.lastAt) : '';

    item.innerHTML = `
      <div class="avatar">${(chat.otherName || '?').charAt(0).toUpperCase()}</div>
      <div class="chat-item-info">
        <div class="chat-item-top">
          <span class="chat-item-name">
            ${escapeHtml(chat.otherName)}
            ${chat.isVerified ? verifiedBadgeSvg() : ''}
            ${chat.isOfficial ? '<span class="official-tag">رسمي</span>' : ''}
          </span>
          <span class="chat-item-time">${time}</span>
        </div>
        <div class="chat-item-preview">${escapeHtml(preview)}</div>
      </div>
    `;
    item.addEventListener('click', () => openChat({
      id: chat.id,
      name: chat.otherName,
      phone: chat.otherPhone,
      is_verified: chat.isVerified,
      is_official: chat.isOfficial,
    }));
    chatList.appendChild(item);
  });
}

function verifiedBadgeSvg() {
  return `<svg class="verified-badge" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.19L12 2.96 8.6 1.51 6.71 4.7l-3.61.81.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82 1.89 3.19L12 21.04l3.4 1.45 1.89-3.19 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z"/></svg>`;
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ============================================================
// نافذة دردشة جديدة — البحث عن مستخدمين برقم الهاتف
// ============================================================
newChatFab.addEventListener('click', () => {
  newChatModal.hidden = false;
  newChatSearch.value = '';
  searchResults.innerHTML = '<p class="search-hint">اكتب رقم الهاتف اللي عايز تدور عليه</p>';
  setTimeout(() => newChatSearch.focus(), 250);
});
newChatClose.addEventListener('click', () => { newChatModal.hidden = true; });

let searchDebounce = null;
newChatSearch.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  const value = newChatSearch.value.trim();

  if (value.length < 8) {
    searchResults.innerHTML = '<p class="search-hint">اكتب رقم الموبايل بالكامل عشان تقدر تدور عليه</p>';
    return;
  }

  searchResults.innerHTML = '<p class="search-hint">بيدور...</p>';
  searchDebounce = setTimeout(() => searchUsers(value), 350);
});

async function searchUsers(phone) {
  try {
    const res = await fetch(`/api/users/search?phone=${encodeURIComponent(phone)}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();

    if (!res.ok) {
      searchResults.innerHTML = `<p class="search-hint">${escapeHtml(data.error || 'حصل خطأ')}</p>`;
      return;
    }

    if (data.users.length === 0) {
      searchResults.innerHTML = '<p class="search-hint">مفيش حد بالرقم ده مسجل في Malg</p>';
      return;
    }

    searchResults.innerHTML = '';
    data.users.forEach((u, index) => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.style.animationDelay = `${index * 40}ms`;
      item.innerHTML = `
        <div class="avatar">${(u.name || '?').charAt(0).toUpperCase()}</div>
        <div class="chat-item-info">
          <div class="chat-item-name">
            ${escapeHtml(u.name)}
            ${u.is_verified ? verifiedBadgeSvg() : ''}
          </div>
          <div class="dim">${escapeHtml(u.phone)}</div>
        </div>
      `;
      item.addEventListener('click', () => {
        newChatModal.hidden = true;
        openChat({
          id: u.id,
          name: u.official_display_name || u.name,
          phone: u.phone,
          is_verified: u.is_verified,
          is_official: u.is_official,
        });
      });
      searchResults.appendChild(item);
    });
  } catch (err) {
    searchResults.innerHTML = '<p class="search-hint">مقدرش أتواصل مع السيرفر</p>';
  }
}

// ============================================================
// شاشة الدردشة الفردية
// ============================================================
function openChat(chat) {
  activeChatId = chat.id;
  activeChat = chat;

  chatName.textContent = chat.name;
  chatAvatar.textContent = (chat.name || '?').charAt(0).toUpperCase();

  listenToMessages(chat.id);
  chatScreen.hidden = false;
  composerInput.value = '';
  setTimeout(() => composerInput.focus(), 200);
}

backBtn.addEventListener('click', () => {
  stopMessagesListener();
  chatScreen.hidden = true;
  activeChatId = null;
  activeChat = null;
});

// استماع مباشر لرسائل المحادثة المفتوحة (أي رسالة جديدة تظهر فوراً من غير تحديث الصفحة)
function listenToMessages(otherId) {
  stopMessagesListener();
  const convId = conversationId(currentUser.id, otherId);
  messagesRef = fbDb.ref(`conversations/${convId}/messages`);

  messagesList.innerHTML = '<p class="messages-empty">بيحمّل الرسائل...</p>';

  messagesRef.on(
    'value',
    (snap) => {
      const data = snap.val() || {};
      const messages = Object.values(data).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      renderMessages(messages);
    },
    (err) => {
      console.error('فشل تحميل الرسائل:', err);
      tryReconnectFirebase('الرسائل');
    }
  );
}

function renderMessages(messages) {
  messagesList.innerHTML = '';
  if (messages.length === 0) {
    messagesList.innerHTML = '<p class="messages-empty">ابعت أول رسالة وابدأ الدردشة</p>';
    return;
  }

  messages.forEach((m, index) => {
    const bubble = document.createElement('div');
    const mine = String(m.senderId) === String(currentUser.id);
    bubble.className = `bubble ${mine ? 'me' : 'them'}`;
    bubble.style.animationDelay = `${Math.min(index, 8) * 20}ms`;
    bubble.textContent = m.text;
    messagesList.appendChild(bubble);
  });
  messagesList.scrollTop = messagesList.scrollHeight;
}

composerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = composerInput.value.trim();
  if (!text || !activeChat) return;

  composerInput.value = '';
  try {
    await sendMessage(activeChat, text);
  } catch (err) {
    console.error('فشل إرسال الرسالة:', err);
    alert('حصل خطأ وإحنا بنبعت الرسالة، جرب تاني');
    composerInput.value = text;
  }
});

// بيبعت الرسالة فعلياً على Firebase Realtime Database، وبيحدّث قائمة الدردشات عند الطرفين
async function sendMessage(chat, text) {
  const myId = String(currentUser.id);
  const otherId = String(chat.id);
  const convId = conversationId(myId, otherId);
  const convRef = fbDb.ref(`conversations/${convId}`);
  const now = firebase.database.ServerValue.TIMESTAMP;

  // تسجيل الاتنين كأعضاء في المحادثة (مطلوب عشان قواعد الأمان تسمح بالقراءة/الكتابة)
  await convRef.child('participants').set({ [myId]: true, [otherId]: true });

  // إضافة الرسالة نفسها
  await convRef.child('messages').push({
    senderId: myId,
    text,
    ts: now,
  });

  // تحديث "آخر رسالة" في قائمة الدردشات عندي وعند الطرف التاني في نفس الوقت
  await fbDb.ref(`userConversations/${myId}/${otherId}`).update({
    convId,
    otherName: chat.name,
    otherPhone: chat.phone,
    isVerified: !!chat.is_verified,
    isOfficial: !!chat.is_official,
    lastMessage: text,
    lastAt: now,
    lastSenderId: myId,
  });

  await fbDb.ref(`userConversations/${otherId}/${myId}`).update({
    convId,
    otherName: currentUser.name,
    otherPhone: currentUser.phone,
    isVerified: false,
    isOfficial: false,
    lastMessage: text,
    lastAt: now,
    lastSenderId: myId,
  });
}

// ============================================================
// Service Worker (PWA)
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
