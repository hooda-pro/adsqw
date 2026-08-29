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
    renderChatList();
  }, 320);
}

logoutBtn.addEventListener('click', () => {
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
      renderChatList();
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
  else chatSearchInput.value = '', renderChatList();
});
chatSearchInput.addEventListener('input', () => renderChatList(chatSearchInput.value.trim()));

// ============================================================
// تخزين الدردشات محلياً على جهاز المستخدم (حسب حسابه)
// ============================================================
function chatsStorageKey() {
  return `malg_chats_${currentUser.id}`;
}
function loadChats() {
  try {
    return JSON.parse(localStorage.getItem(chatsStorageKey())) || [];
  } catch (err) {
    return [];
  }
}
function saveChats(chats) {
  localStorage.setItem(chatsStorageKey(), JSON.stringify(chats));
}

function renderChatList(filter = '') {
  const chats = loadChats().sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
  const filtered = filter
    ? chats.filter((c) => c.name.includes(filter) || c.phone.includes(filter))
    : chats;

  chatList.innerHTML = '';
  emptyChats.hidden = chats.length > 0;

  filtered.forEach((chat, index) => {
    const item = document.createElement('div');
    item.className = 'chat-item';
    item.style.animationDelay = `${index * 40}ms`;

    const lastMsg = chat.messages[chat.messages.length - 1];
    const preview = lastMsg ? lastMsg.text : 'ابدأ المحادثة';
    const time = lastMsg ? formatTime(lastMsg.ts) : '';

    item.innerHTML = `
      <div class="avatar">${(chat.name || '?').charAt(0).toUpperCase()}</div>
      <div class="chat-item-info">
        <div class="chat-item-top">
          <span class="chat-item-name">
            ${escapeHtml(chat.name)}
            ${chat.is_verified ? verifiedBadgeSvg() : ''}
            ${chat.is_official ? '<span class="official-tag">رسمي</span>' : ''}
          </span>
          <span class="chat-item-time">${time}</span>
        </div>
        <div class="chat-item-preview">${escapeHtml(preview)}</div>
      </div>
    `;
    item.addEventListener('click', () => openChat(chat));
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

  if (value.length < 3) {
    searchResults.innerHTML = '<p class="search-hint">اكتب 3 أرقام على الأقل</p>';
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
          messages: getExistingMessages(u.id),
        });
      });
      searchResults.appendChild(item);
    });
  } catch (err) {
    searchResults.innerHTML = '<p class="search-hint">مقدرش أتواصل مع السيرفر</p>';
  }
}

function getExistingMessages(userId) {
  const existing = loadChats().find((c) => c.id === userId);
  return existing ? existing.messages : [];
}

// ============================================================
// شاشة الدردشة الفردية
// ============================================================
function openChat(chat) {
  activeChatId = chat.id;

  // لو أول مرة يتكلم مع الشخص ده، نضيفه لقائمة الدردشات
  const chats = loadChats();
  if (!chats.find((c) => c.id === chat.id)) {
    chats.push({ ...chat, lastAt: Date.now(), messages: chat.messages || [] });
    saveChats(chats);
  }

  chatName.textContent = chat.name;
  chatAvatar.textContent = (chat.name || '?').charAt(0).toUpperCase();

  renderMessages(chat.id);
  chatScreen.hidden = false;
  composerInput.value = '';
  setTimeout(() => composerInput.focus(), 200);
}

backBtn.addEventListener('click', () => {
  chatScreen.hidden = true;
  activeChatId = null;
  renderChatList();
});

function renderMessages(chatId) {
  const chats = loadChats();
  const chat = chats.find((c) => c.id === chatId);
  const messages = chat ? chat.messages : [];

  messagesList.innerHTML = '';
  if (messages.length === 0) {
    messagesList.innerHTML = '<p class="messages-empty">ابعت أول رسالة وابدأ الدردشة</p>';
    return;
  }

  messages.forEach((m, index) => {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${m.from === 'me' ? 'me' : 'them'}`;
    bubble.style.animationDelay = `${Math.min(index, 8) * 20}ms`;
    bubble.textContent = m.text;
    messagesList.appendChild(bubble);
  });
  messagesList.scrollTop = messagesList.scrollHeight;
}

composerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = composerInput.value.trim();
  if (!text || !activeChatId) return;

  const chats = loadChats();
  const chat = chats.find((c) => c.id === activeChatId);
  if (!chat) return;

  chat.messages.push({ text, from: 'me', ts: Date.now() });
  chat.lastAt = Date.now();
  saveChats(chats);

  composerInput.value = '';
  renderMessages(activeChatId);
});

// ============================================================
// Service Worker (PWA)
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
