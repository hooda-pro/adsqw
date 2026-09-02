// public/js/app.js
// ============================================================
// المتحكم الرئيسي للواجهة.
// أهم 3 حاجات اتصلّحت هنا:
//   1) كل listener على Firebase له error callback — قبل كده الفشل كان صامت تمامًا.
//   2) ensureConversation() بتتنفّذ قبل أي listener على الرسايل، فمفيش permission_denied
//      لأول واحد يفتح دردشة جديدة (ده كان سبب "الرسايل بتبان على الفون ومش بتبان على الكمبيوتر").
//   3) الدردشة بتتسجّل في القائمة أول ما تفتحها — فبتفضل موجودة في الشاشة الرئيسية
//      زي واتساب حتى لو خرجت من غير ما تبعت حاجة.
// ============================================================
(function () {
  'use strict';

  const Phone = window.MalgPhone;
  const Fmt = window.MalgFormat;
  const Paths = window.MalgPaths;
  const Store = window.MalgStore;

  const MAX_IMAGE_MB = 15;
  const MAX_VIDEO_MB = 100;

  const TOKEN_KEY = 'malg_token';
  const SUPPORT_WHATSAPP = '201065749774';
  const TYPING_TTL = 6000; // بعد قد كده من غير تحديث نعتبره وقف كتابة
  const TYPING_PING = 2500; // كل قد إيه نجدّد علامة "بيكتب"
  const MAX_COMPOSER_H = 168;
  const MESSAGES_WINDOW = 300;

  const $ = (id) => document.getElementById(id);

  const el = {
    body: document.body,
    // auth
    tabLogin: $('tabLogin'), tabSignup: $('tabSignup'),
    loginForm: $('loginForm'), signupForm: $('signupForm'),
    loginPhone: $('loginPhone'), loginPassword: $('loginPassword'),
    loginError: $('loginError'), loginBtn: $('loginBtn'),
    signupName: $('signupName'), signupPhone: $('signupPhone'),
    signupPassword: $('signupPassword'), signupError: $('signupError'), signupBtn: $('signupBtn'),
    forgotLink: $('forgotLink'), forgotWhatsapp: $('forgotWhatsapp'),
    // app
    meAvatar: $('meAvatar'), meName: $('meName'), mePhone: $('mePhone'), logoutBtn: $('logoutBtn'),
    chatFilter: $('chatFilter'), chatList: $('chatList'), chatsEmpty: $('chatsEmpty'),
    newChatBtn: $('newChatBtn'),
    chatView: $('chatView'), backBtn: $('backBtn'),
    chatAvatar: $('chatAvatar'), chatName: $('chatName'), chatStatus: $('chatStatus'),
    messages: $('messages'),
    composerForm: $('composerForm'), composerInput: $('composerInput'), sendBtn: $('sendBtn'),
    attachBtn: $('attachBtn'), mediaInput: $('mediaInput'),
    // modals
    newChatModal: $('newChatModal'), searchForm: $('searchForm'),
    searchPhone: $('searchPhone'), searchBtn: $('searchBtn'), searchOut: $('searchOut'),
    forgotModal: $('forgotModal'), toasts: $('toasts'),
  };

  // ---------- الحالة ----------
  const state = {
    token: null,
    me: null,
    chats: new Map(), // otherId -> chat
    filter: '',
    activeId: null,
    messages: [],
    pending: new Map(), // cid -> رسالة مؤقتة لسه ما وصلتش
    pendingLocalUrls: new Map(), // cid -> blob URL محلي للصورة/الفيديو، لحد ما نتأكد إن النسخة الحقيقية وصلت
    cleanedIds: new Set(), // آي-ديهات الرسايل اللي اتمسحت من Firebase بعد ما اتخزنت على الجهاز — عشان منحاولش تاني كل مرة
    otherReadAt: 0,
    otherTypingAt: 0,
    presence: null,
    lastTypingPing: 0,
    typingTimer: null,
    pushedHistory: false,
  };

  let db = null;
  const off = {}; // detach functions لكل listener

  function detach(key) {
    if (typeof off[key] === 'function') {
      try { off[key](); } catch (_) { /* السماعة ماتت أصلاً */ }
    }
    off[key] = null;
  }

  function detachChatListeners() {
    ['messages', 'typing', 'reads', 'presence'].forEach(detach);
  }

  const myId = () => (state.me ? String(state.me.id) : '');
  const stamp = () => firebase.database.ServerValue.TIMESTAMP;

  // ---------- أدوات صغيرة ----------
  function toast(message, kind) {
    const box = document.createElement('div');
    box.className = 'toast' + (kind ? ' is-' + kind : '');
    box.textContent = message;
    el.toasts.appendChild(box);
    setTimeout(() => box.remove(), 4200);
  }

  function svgIcon(cls, path) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    if (cls) svg.setAttribute('class', cls);
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', path);
    svg.appendChild(p);
    return svg;
  }

  const CHECK_PATH = 'M5 13l4 4L19 7';

  async function api(path, opts) {
    const o = opts || {};
    const headers = {};
    if (o.body) headers['Content-Type'] = 'application/json';
    if (o.auth !== false && state.token) headers.Authorization = 'Bearer ' + state.token;

    let res;
    try {
      res = await fetch(path, {
        method: o.method || 'GET',
        headers,
        body: o.body ? JSON.stringify(o.body) : undefined,
      });
    } catch (netErr) {
      throw Object.assign(new Error('مفيش نت — راجع الاتصال وحاول تاني'), { offline: true });
    }

    let data = {};
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) {
      throw Object.assign(new Error(data.error || 'حصل خطأ، حاول تاني'), { status: res.status, data });
    }
    return data;
  }

  function setPane(name) {
    el.body.dataset.pane = name;
  }

  function openSheet(id) {
    const node = el[id];
    if (!node) return;
    node.hidden = false;
    const input = node.querySelector('input');
    if (input) setTimeout(() => input.focus(), 60);
  }

  function closeSheet(id) {
    const node = el[id];
    if (node) node.hidden = true;
  }

  document.addEventListener('click', (ev) => {
    const target = ev.target.closest('[data-close]');
    if (target) closeSheet(target.getAttribute('data-close'));
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (!el.newChatModal.hidden) { closeSheet('newChatModal'); return; }
    if (!el.forgotModal.hidden) { closeSheet('forgotModal'); return; }
    if (state.activeId && !matchMedia('(min-width: 900px)').matches) closeChat();
  });

  // ============================================================
  // تسجيل الدخول
  // ============================================================
  function showTab(which) {
    const login = which === 'login';
    el.tabLogin.classList.toggle('is-on', login);
    el.tabSignup.classList.toggle('is-on', !login);
    el.tabLogin.setAttribute('aria-selected', String(login));
    el.tabSignup.setAttribute('aria-selected', String(!login));
    el.loginForm.classList.toggle('is-hidden', !login);
    el.signupForm.classList.toggle('is-hidden', login);
    el.loginError.textContent = '';
    el.signupError.textContent = '';
  }

  el.tabLogin.addEventListener('click', () => showTab('login'));
  el.tabSignup.addEventListener('click', () => showTab('signup'));

  el.forgotLink.addEventListener('click', () => {
    el.forgotWhatsapp.href = 'https://wa.me/' + SUPPORT_WHATSAPP;
    openSheet('forgotModal');
  });

  el.loginForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const phone = el.loginPhone.value;
    const password = el.loginPassword.value;

    const phoneProblem = Phone.phoneError(phone);
    if (phoneProblem) { el.loginError.textContent = phoneProblem; return; }
    if (!password) { el.loginError.textContent = 'اكتب كلمة السر'; return; }

    el.loginError.textContent = '';
    el.loginBtn.disabled = true;
    el.loginBtn.textContent = 'بيدخّلك…';
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: { phone: Phone.canonicalPhone(phone), password },
      });
      saveToken(data.token);
      await enterApp(data.user);
    } catch (err) {
      el.loginError.textContent = err.message;
    } finally {
      el.loginBtn.disabled = false;
      el.loginBtn.textContent = 'دخول';
    }
  });

  el.signupForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = el.signupName.value.trim();
    const phone = el.signupPhone.value;
    const password = el.signupPassword.value;

    if (name.length < 2) { el.signupError.textContent = 'اكتب اسمك (حرفين على الأقل)'; return; }
    const phoneProblem = Phone.phoneError(phone);
    if (phoneProblem) { el.signupError.textContent = phoneProblem; return; }
    if (password.length < 6) { el.signupError.textContent = 'كلمة السر لازم 6 حروف على الأقل'; return; }

    el.signupError.textContent = '';
    el.signupBtn.disabled = true;
    el.signupBtn.textContent = 'بيعمل الحساب…';
    try {
      const data = await api('/api/auth/signup', {
        method: 'POST',
        auth: false,
        body: { name, phone: Phone.canonicalPhone(phone), password },
      });
      saveToken(data.token);
      await enterApp(data.user);
    } catch (err) {
      el.signupError.textContent = err.message;
    } finally {
      el.signupBtn.disabled = false;
      el.signupBtn.textContent = 'إنشاء الحساب';
    }
  });

  function saveToken(token) {
    state.token = token;
    try { localStorage.setItem(TOKEN_KEY, token); } catch (_) { /* تخزين مقفول */ }
  }

  function clearToken() {
    state.token = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch (_) { /* تخزين مقفول */ }
  }

  function showAuth() {
    el.body.dataset.view = 'auth';
    showTab('login');
    setTimeout(() => el.loginPhone.focus(), 80);
  }

  el.logoutBtn.addEventListener('click', async () => {
    try {
      if (db && state.me) await db.ref(Paths.presence(myId())).set({ state: 'offline', lastChanged: Date.now() });
    } catch (_) { /* عادي */ }
    clearToken();
    location.reload();
  });

  // ============================================================
  // الدخول للتطبيق + Firebase
  // ============================================================
  async function enterApp(user) {
    state.me = user;
    paintMe();
    el.body.dataset.view = 'app';
    setPane('list');

    // بنجهّز التخزين المحلي على جهاز المستخدم ده، ونرسم أي دردشات اتخزنت
    // فيه من قبل فورًا — من غير ما ننتظر Firebase أصلًا (زي واتساب أول
    // ما تفتحه: بتشوف شاتاتك على طول من غير "بيحمّل").
    await Store.init(user.id);
    const cachedChats = await Store.getChats();
    cachedChats.forEach((c) => state.chats.set(String(c.id), c));
    renderChatList();

    try {
      await signIntoFirebase();
    } catch (err) {
      console.error('Firebase sign-in failed', err);
      toast('مش قادر أوصل لسيرفر الرسايل — حدّث الصفحة أو راجع إعدادات Firebase', 'error');
      return;
    }

    trackMyPresence();
    listenChatList();
  }

  function paintMe() {
    el.meName.textContent = state.me.official_display_name || state.me.name || 'أنا';
    el.mePhone.textContent = Phone.formatPhoneForDisplay(state.me.phone || '');
    el.meAvatar.textContent = Fmt.initials(state.me.name);
  }

  async function signIntoFirebase() {
    if (!window.firebase || !window.FIREBASE_CONFIG) throw new Error('firebase sdk/config missing');
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    const data = await api('/api/firebase-token');
    await firebase.auth().signInWithCustomToken(data.firebaseToken);
    db = firebase.database();
  }

  /** حضور حقيقي: online دلوقتي + offline أوتوماتيك لو النت قطع أو التاب اتقفل */
  function trackMyPresence() {
    const ref = db.ref(Paths.presence(myId()));
    const conn = db.ref('.info/connected');
    conn.on('value', (snap) => {
      if (snap.val() !== true) return;
      ref.onDisconnect().set({ state: 'offline', lastChanged: stamp() })
        .then(() => ref.set({ state: 'online', lastChanged: stamp() }))
        .catch((err) => console.warn('presence write failed', err && err.code));
    }, (err) => console.warn('presence connection listener failed', err && err.code));
  }

  // ============================================================
  // قائمة الدردشات — السماعة على userConversations/<uid> نفسه
  // (القاعدة لازم يكون فيها ".read" على المستوى ده بالظبط، مش على الابن)
  // ============================================================
  function normalizeChat(otherId, raw) {
    const r = raw || {};
    return {
      id: String(otherId),
      convId: r.convId || Paths.conversationId(myId(), otherId),
      otherName: r.otherName || 'مستخدم',
      otherPhone: r.otherPhone || '',
      isVerified: !!r.isVerified,
      isOfficial: !!r.isOfficial,
      lastMessage: r.lastMessage || '',
      lastAt: Number(r.lastAt) || 0,
      lastSenderId: r.lastSenderId !== undefined ? String(r.lastSenderId) : undefined,
      unread: Number(r.unread) || 0,
      myReadAt: Number(r.myReadAt) || 0,
    };
  }

  function listenChatList() {
    detach('chatList');
    const ref = db.ref(Paths.userChats(myId()));
    const cb = ref.on(
      'value',
      (snap) => {
        const data = snap.val() || {};
        const active = state.activeId ? state.chats.get(state.activeId) : null;
        state.chats.clear();
        Object.keys(data).forEach((otherId) => {
          state.chats.set(String(otherId), normalizeChat(otherId, data[otherId]));
        });
        // الدردشة المفتوحة لازم تفضل في القائمة حتى لو لسه ماتكتبتش على السيرفر
        if (active && !state.chats.has(active.id)) state.chats.set(active.id, active);
        renderChatList();
        if (state.activeId) paintChatHeader();
        Store.saveChats(Array.from(state.chats.values()));
      },
      (err) => {
        console.error('chat list listener failed:', err && err.code, err);
        toast('مش قادر أجيب دردشاتك — لازم تحدّث قواعد الأمان في Firebase', 'error');
      }
    );
    off.chatList = () => ref.off('value', cb);
  }

  el.chatFilter.addEventListener('input', () => {
    state.filter = el.chatFilter.value;
    renderChatList();
  });

  function renderChatList() {
    const all = Fmt.sortChats(Array.from(state.chats.values()));
    const shown = Fmt.filterChats(all, state.filter);

    el.chatList.textContent = '';
    shown.forEach((chat) => el.chatList.appendChild(chatRow(chat)));

    const empty = shown.length === 0;
    el.chatsEmpty.classList.toggle('is-on', empty);
    if (empty) {
      const searching = all.length > 0;
      el.chatsEmpty.children[0].textContent = searching ? 'مفيش نتيجة' : 'مفيش دردشات لسه';
      el.chatsEmpty.children[1].textContent = searching
        ? 'مافيش دردشة بالاسم أو الرقم اللي كتبته'
        : 'اضغط الزر التحت وابدأ محادثة برقم الموبايل';
    }
  }

  function chatRow(chat) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-row' + (chat.id === state.activeId ? ' is-active' : '');
    btn.dataset.id = chat.id;

    const avatar = document.createElement('span');
    avatar.className = 'avatar avatar-sm';
    avatar.textContent = Fmt.initials(chat.otherName);

    const main = document.createElement('span');
    main.className = 'chat-row-main';

    const top = document.createElement('span');
    top.className = 'chat-row-top';
    const name = document.createElement('span');
    name.className = 'chat-row-name';
    name.textContent = chat.otherName;
    top.appendChild(name);
    if (chat.isVerified) top.appendChild(svgIcon('verified', CHECK_PATH));
    if (chat.isOfficial) {
      const badge = document.createElement('span');
      badge.className = 'official';
      badge.textContent = 'رسمي';
      top.appendChild(badge);
    }

    const prev = document.createElement('span');
    prev.className = 'chat-row-prev';
    prev.textContent = Fmt.previewText(chat, myId());

    main.appendChild(top);
    main.appendChild(prev);

    const side = document.createElement('span');
    side.className = 'chat-row-side';
    const time = document.createElement('span');
    time.className = 'chat-row-time';
    time.textContent = Fmt.chatListStamp(chat.lastAt);
    side.appendChild(time);

    const unread = Fmt.unreadCount(chat, myId());
    if (unread > 0 && chat.id !== state.activeId) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = unread > 99 ? '99+' : String(unread);
      side.appendChild(badge);
    }

    btn.appendChild(avatar);
    btn.appendChild(main);
    btn.appendChild(side);
    btn.addEventListener('click', () => openChat(chat));
    li.appendChild(btn);
    return li;
  }

  // ============================================================
  // فتح دردشة
  // ============================================================
  /** بيوحّد شكل بيانات الشخص سواء جاية من القائمة أو من نتيجة البحث */
  function identityOf(input) {
    if (input.otherName !== undefined || input.otherPhone !== undefined) {
      return {
        otherName: input.otherName || 'مستخدم',
        otherPhone: input.otherPhone || '',
        isVerified: !!input.isVerified,
        isOfficial: !!input.isOfficial,
      };
    }
    return {
      otherName: input.official_display_name || input.name || 'مستخدم',
      otherPhone: Phone.canonicalPhone(input.phone) || String(input.phone || ''),
      isVerified: !!input.is_verified,
      isOfficial: !!input.is_official,
    };
  }

  /** بتفضّي قائمة الرسايل المؤقتة وتسيب أي معاينة محلية (blob URL) من الذاكرة */
  function clearPending() {
    state.pending.clear();
    state.pendingLocalUrls.forEach((u) => URL.revokeObjectURL(u));
    state.pendingLocalUrls.clear();
  }

  async function openChat(input) {
    if (!db) { toast('لسه بيتصل بسيرفر الرسايل — استنى شوية', 'warn'); return; }

    const otherId = String(input.id);
    const convId = Paths.conversationId(myId(), otherId);
    const chat = Object.assign(
      { id: otherId, convId, lastAt: 0, unread: 0, myReadAt: 0, lastMessage: '' },
      state.chats.get(otherId) || {},
      identityOf(input),
      { convId }
    );

    state.chats.set(otherId, chat);
    state.activeId = otherId;
    state.messages = [];
    clearPending();
    state.cleanedIds = new Set();
    resetMessageDom();
    state.otherReadAt = 0;
    state.otherTypingAt = 0;
    state.presence = null;

    detachChatListeners();
    closeSheet('newChatModal');
    el.chatView.hidden = false;
    setPane('chat');
    paintChatHeader();
    renderChatList();
    resetComposer();
    pushChatHistory(otherId);

    // بنعرض الرسايل المخزّنة على الجهاز فورًا (لو موجودة) بدل "بيحمّل"،
    // ولما Firebase يرد هيستبدلها بالنسخة المحدّثة.
    const cachedMsgs = await Store.getMessages(convId);
    if (state.activeId !== otherId) return;
    if (cachedMsgs.length) { state.messages = cachedMsgs; renderMessages(); }
    else renderMessages({ loading: true });

    // ⚠️ الترتيب مهم: participants + تسجيل الدردشة الأول، بعدين السماعات.
    // لو عكسنا، أول واحد يفتح دردشة جديدة بياخد permission_denied وبيقعد على "بيحمّل" للأبد.
    try {
      await ensureConversation(chat);
    } catch (err) {
      console.error('ensureConversation failed:', err && err.code, err);
      renderMessages({ error: 'مش قادر أفتح المحادثة — تأكد إنك نسخت قواعد الأمان الجديدة في Firebase' });
      return;
    }

    if (state.activeId !== otherId) return; // المستخدم فتح دردشة تانية في الوقت ده

    listenMessages(convId);
    listenTyping(convId, otherId);
    listenReads(convId, otherId);
    listenPresence(otherId);
    markRead();

    if (matchMedia('(min-width: 900px)').matches) el.composerInput.focus();
  }

  /**
   * بتسجّل الدردشة قبل أي قراية:
   *   - participants (بـ update مش set عشان منمسحش الطرف التاني)
   *   - سطر الدردشة في قائمتي أنا — وده اللي بيخلّيها تفضل في الشاشة الرئيسية
   *     حتى لو خرجت من غير ما تبعت رسالة (زي واتساب).
   * الطرف التاني بتتسجّل عنده أول رسالة تتبعت — مش قبل كده عشان
   * مايشوفش دردشات فاضية من ناس ماكلمتوهش.
   */
  async function ensureConversation(chat) {
    const me = myId();
    const other = String(chat.id);
    await db.ref(Paths.participants(chat.convId)).update({ [me]: true, [other]: true });
    await db.ref(Paths.userChat(me, other)).update({
      convId: chat.convId,
      otherName: chat.otherName,
      otherPhone: chat.otherPhone,
      isVerified: !!chat.isVerified,
      isOfficial: !!chat.isOfficial,
    });
  }

  function paintChatHeader() {
    const chat = state.chats.get(state.activeId);
    if (!chat) return;
    el.chatAvatar.textContent = Fmt.initials(chat.otherName);
    el.chatName.textContent = '';
    el.chatName.appendChild(document.createTextNode(chat.otherName));
    if (chat.isVerified) el.chatName.appendChild(svgIcon('verified', CHECK_PATH));
    paintStatus();
  }

  function paintStatus() {
    const typing = state.otherTypingAt > Date.now() - TYPING_TTL;
    el.chatStatus.classList.toggle('is-typing', typing);
    el.chatStatus.classList.toggle('is-online', !typing && !!(state.presence && state.presence.state === 'online'));
    el.chatStatus.textContent = typing ? 'بيكتب…' : Fmt.presenceText(state.presence);
  }

  function closeChat() {
    detachChatListeners();
    clearMyTyping();
    state.activeId = null;
    state.messages = [];
    clearPending();
    resetMessageDom();
    el.chatView.hidden = true;
    setPane('list');
    renderChatList();
  }

  el.backBtn.addEventListener('click', () => {
    if (state.pushedHistory) { history.back(); return; } // popstate هو اللي بيقفل
    closeChat();
  });

  // زرار الرجوع بتاع المتصفح/الموبايل بيقفل الشات بدل ما يخرج من التطبيق
  function pushChatHistory(otherId) {
    if (!state.pushedHistory) {
      try {
        history.pushState({ malgChat: otherId }, '');
        state.pushedHistory = true;
      } catch (_) { /* بعض المتصفحات بتقيّد ده */ }
    }
  }

  window.addEventListener('popstate', () => {
    state.pushedHistory = false;
    if (state.activeId) closeChat();
  });

  // ============================================================
  // الرسايل
  // ============================================================
  function listenMessages(convId) {
    detach('messages');
    const ref = db.ref(Paths.messages(convId)).orderByChild('ts').limitToLast(MESSAGES_WINDOW);
    const cb = ref.on(
      'value',
      (snap) => {
        const live = [];
        snap.forEach((child) => {
          const v = child.val() || {};
          live.push({
            id: child.key,
            senderId: String(v.senderId),
            text: String(v.text || ''),
            ts: Number(v.ts) || 0,
            cid: v.cid,
            type: v.type || 'text',
            mediaUrl: v.mediaUrl || null,
          });
        });
        live.sort((a, b) => (a.ts || 0) - (b.ts || 0));

        // تصليح: الرسالة كانت بتتأخر شوية عشان كنا بننتظر (await) قراءة/كتابة
        // IndexedDB قبل ما نعرض حاجة على الشاشة خالص. دلوقتي العرض فوري
        // (مثل ما كان بالظبط)، والتخزين على الجهاز والتنضيف بيحصلوا في
        // الخلفية من غير ما يأخّروا ظهور الرسالة ولا نقطة واحدة.
        //
        // بندمج مع اللي عندي في الذاكرة أصلاً (مش هنفتح IndexedDB تاني) —
        // ده كافي عشان أي رسالة كانت اتحمّلت من الجهاز لما فتحت الشات
        // (في openChat) تفضل ظاهرة حتى لو السيرفر مسحها بعد كده.
        const byId = new Map(state.messages.map((m) => [m.id, m]));
        live.forEach((m) => byId.set(m.id, m));
        state.messages = Array.from(byId.values()).sort((a, b) => (a.ts || 0) - (b.ts || 0));

        live.forEach((m) => {
          if (!m.cid) return;
          state.pending.delete(m.cid);
          const u = state.pendingLocalUrls.get(m.cid);
          if (u) { URL.revokeObjectURL(u); state.pendingLocalUrls.delete(m.cid); }
        });
        renderMessages();
        markRead();

        // تخزين على جهاز المستخدم — في الخلفية، مايأخّرش ظهور الرسالة
        Store.saveMessages(convId, live).catch(() => {});

        // تنضيف: الرسايل اللي وصلتلي (مش أنا اللي بعتها) وخزّنتها فوق،
        // بقت آمنة تتشال من Firebase — بالظبط زي واتساب. ده كمان بيحصل
        // في الخلفية، مايأخّرش ولا يوقف عرض الرسالة.
        const me = myId();
        live.forEach((m) => {
          if (String(m.senderId) === me) return; // رسايلي أنا: الطرف التاني هو اللي هيمسحها لما يستقبلها
          if (state.cleanedIds.has(m.id)) return;
          state.cleanedIds.add(m.id);
          db.ref(Paths.messages(convId) + '/' + m.id).remove()
            .catch((err) => { state.cleanedIds.delete(m.id); console.warn('مسح الرسالة من السيرفر فشل (هيتعاد المحاولة تلقائي)', err && err.code); });
        });
      },
      (err) => {
        console.error('messages listener failed:', err && err.code, err);
        renderMessages({ error: 'مش قادر أجيب الرسايل — تأكد إنك حدّثت قواعد الأمان في Firebase' });
      }
    );
    off.messages = () => ref.off('value', cb);
  }

  function listenTyping(convId, otherId) {
    detach('typing');
    const ref = db.ref(Paths.typing(convId, otherId));
    const cb = ref.on(
      'value',
      (snap) => {
        state.otherTypingAt = Number(snap.val()) || 0;
        paintStatus();
        renderMessages();
        if (state.typingTimer) clearTimeout(state.typingTimer);
        state.typingTimer = setTimeout(() => { paintStatus(); renderMessages(); }, TYPING_TTL + 200);
      },
      (err) => console.warn('typing listener failed', err && err.code)
    );
    off.typing = () => ref.off('value', cb);
  }

  function listenReads(convId, otherId) {
    detach('reads');
    const ref = db.ref(Paths.reads(convId, otherId));
    const cb = ref.on(
      'value',
      (snap) => {
        state.otherReadAt = Number(snap.val()) || 0;
        renderMessages();
      },
      (err) => console.warn('reads listener failed', err && err.code)
    );
    off.reads = () => ref.off('value', cb);
  }

  function listenPresence(otherId) {
    detach('presence');
    const ref = db.ref(Paths.presence(otherId));
    const cb = ref.on(
      'value',
      (snap) => { state.presence = snap.val(); paintStatus(); },
      (err) => { console.warn('presence listener failed', err && err.code); state.presence = null; paintStatus(); }
    );
    off.presence = () => ref.off('value', cb);
  }

  function isNearBottom(box) {
    return box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  }

  function note(cls, text) {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    return p;
  }

  // تصليح "الشاشة بترقص": قبل كده renderMessages() كانت بتمسح كل الرسايل
  // وتعيد بناءها من الصفر مع كل تحديث من Firebase — وده معناه إن أنيميشن
  // ظهور كل رسالة (حتى القديمة اللي ظاهرة بالفعل) كانت بتتكرر تاني، وده
  // اتفاقم لما بقينا بنمسح الرسايل من السيرفر أول ما توصل (كل رسالة
  // بتوصل بتعمل تحديث، وكل مسح بيعمل تحديث تاني). دلوقتي بنحدّث بس
  // اللي اتغيّر فعلاً (حالة القراءة، نسبة رفع الصورة...) ونسيب أي رسالة
  // ظاهرة زي ما هي من غير ما نعيد بناءها.
  const renderedNodes = new Map(); // key -> DOM node
  let renderedKeys = [];

  function timelineKey(item) {
    if (item.kind === 'divider') return 'd:' + item.label;
    const m = item.message;
    return 'm:' + (m.pending ? 'p:' + m.cid : m.id);
  }

  function dividerNode(item) {
    const d = document.createElement('div');
    d.className = 'msg-day';
    d.textContent = item.label;
    return d;
  }

  function updateNode(node, item) {
    if (item.kind === 'divider') return; // نص ثابت، مفيش تحديث لازم
    const m = item.message;
    if ((m.type === 'image' || m.type === 'video') && typeof m.uploadPct === 'number') {
      const bar = node.querySelector('.msg-media-progress');
      if (bar) bar.style.setProperty('--pct', m.uploadPct + '%');
      else if (m.uploadPct >= 100) { /* هيتشال في المرة الجاية لو الرسالة اتغيرت فعلاً */ }
    }
    if (!item.mine) return;
    const tick = node.querySelector('.msg-tick');
    if (!tick) return;
    const status = m.pending ? 'pending' : Fmt.messageStatus(m, state.otherReadAt);
    const wantRead = status === 'read';
    if (tick.classList.contains('is-read') !== wantRead) tick.classList.toggle('is-read', wantRead);
    const wantText = status === 'pending' ? '···' : wantRead ? '✓✓' : '✓';
    if (tick.textContent !== wantText) tick.textContent = wantText;
    tick.title = status === 'pending' ? 'بيتبعت' : status === 'read' ? 'اتقرأت' : 'اتبعتت';
  }

  function resetMessageDom() {
    el.messages.textContent = '';
    renderedNodes.clear();
    renderedKeys = [];
  }

  function renderMessages(opts) {
    const o = opts || {};
    const box = el.messages;
    const stick = isNearBottom(box);

    if (o.loading) { resetMessageDom(); box.appendChild(note('msg-empty', 'بيحمّل الرسايل…')); return; }
    if (o.error) { resetMessageDom(); box.appendChild(note('msg-error', o.error)); return; }

    const pending = Array.from(state.pending.values());
    const all = state.messages.concat(pending);

    const oldTyping = box.querySelector('.msg-typing-row');
    if (oldTyping) oldTyping.remove();

    if (all.length === 0 && state.otherTypingAt <= Date.now() - TYPING_TTL) {
      resetMessageDom();
      box.appendChild(note('msg-empty', 'مفيش رسايل لسه — ابعت أول رسالة'));
      return;
    }
    if (box.querySelector('.msg-empty')) resetMessageDom();

    const timeline = Fmt.buildTimeline(all, myId());
    const newKeys = [];
    const seen = new Set();

    timeline.forEach((item) => {
      const key = timelineKey(item);
      newKeys.push(key);
      seen.add(key);
      let node = renderedNodes.get(key);
      if (node) updateNode(node, item);
      else {
        node = item.kind === 'divider' ? dividerNode(item) : bubble(item);
        renderedNodes.set(key, node);
      }
    });

    renderedKeys.forEach((k) => {
      if (!seen.has(k)) {
        const n = renderedNodes.get(k);
        if (n && n.parentNode) n.remove();
        renderedNodes.delete(k);
      }
    });

    // ترتيب العناصر جوه الصندوق — إعادة ترتيب عنصر موجود بالفعل بـ insertBefore
    // مابيعيدش أنيميشن الدخول بتاعته (المتصفح مابيعتبروش عنصر جديد)
    let ref = box.firstChild;
    if (ref && ref.classList && ref.classList.contains('msg-typing-row')) ref = ref.nextSibling;
    newKeys.forEach((k) => {
      const n = renderedNodes.get(k);
      if (n !== ref) box.insertBefore(n, ref);
      ref = n.nextSibling;
    });
    renderedKeys = newKeys;

    if (state.otherTypingAt > Date.now() - TYPING_TTL) box.appendChild(typingBubble());
    if (stick) box.scrollTop = box.scrollHeight;
  }

  function bubble(item) {
    const m = item.message;
    const div = document.createElement('div');
    div.className = 'msg ' + (item.mine ? 'is-mine' : 'is-theirs');
    if (item.startsGroup) div.classList.add('starts-group');
    if (item.endsGroup) div.classList.add('ends-group');
    if (m.pending) div.classList.add('is-pending');

    if (m.type === 'image' || m.type === 'video') {
      div.classList.add('has-media');
      const wrap = document.createElement('div');
      wrap.className = 'msg-media';
      const media = m.type === 'video' ? document.createElement('video') : document.createElement('img');
      media.src = m.mediaUrl;
      if (m.type === 'video') { media.controls = true; media.playsInline = true; }
      else { media.loading = 'lazy'; media.alt = 'صورة'; }
      // لو الملف فشل يوصل (مثلاً قواعد Firebase Storage مش متفعّلة) — نوريك
      // رسالة واضحة بدل أيقونة "صورة مكسورة" غامضة محدش يعرف سببها
      media.addEventListener('error', () => {
        wrap.classList.add('is-broken');
        wrap.textContent = '';
        const warn = document.createElement('span');
        warn.className = 'msg-media-error';
        warn.textContent = m.type === 'video' ? '⚠️ الفيديو ماوصلش' : '⚠️ الصورة ماوصلتش';
        wrap.appendChild(warn);
      });
      wrap.appendChild(media);

      if (typeof m.uploadPct === 'number' && m.uploadPct < 100) {
        const bar = document.createElement('span');
        bar.className = 'msg-media-progress';
        bar.style.setProperty('--pct', m.uploadPct + '%');
        wrap.appendChild(bar);
      } else if (m.type === 'image') {
        wrap.style.cursor = 'zoom-in';
        wrap.addEventListener('click', () => { if (!wrap.classList.contains('is-broken')) openLightbox(m.mediaUrl, false); });
      }
      div.appendChild(wrap);

      const isPlaceholder = m.text === '📷 صورة' || m.text === '🎥 فيديو';
      if (!isPlaceholder && m.text) {
        const cap = document.createElement('div');
        cap.className = 'msg-caption';
        cap.appendChild(document.createTextNode(m.text));
        div.appendChild(cap);
      }
    } else {
      // textContent مش innerHTML — أي رسالة فيها HTML بتظهر كنص عادي
      div.appendChild(document.createTextNode(m.text));
    }

    const meta = document.createElement('span');
    meta.className = 'msg-meta';
    const time = document.createElement('span');
    time.textContent = m.pending ? '' : Fmt.timeOfDay(m.ts);
    meta.appendChild(time);

    if (item.mine) {
      const status = m.pending ? 'pending' : Fmt.messageStatus(m, state.otherReadAt);
      const tick = document.createElement('span');
      tick.className = 'msg-tick' + (status === 'read' ? ' is-read' : '');
      tick.textContent = status === 'pending' ? '···' : status === 'read' ? '✓✓' : '✓';
      tick.title = status === 'pending' ? 'بيتبعت' : status === 'read' ? 'اتقرأت' : 'اتبعتت';
      meta.appendChild(tick);
    }

    div.appendChild(meta);
    return div;
  }

  /** فتح الصورة بحجمها الكامل فوق الشاشة كلها */
  function openLightbox(url) {
    const wrap = document.createElement('div');
    wrap.className = 'lightbox';
    const img = document.createElement('img');
    img.src = url;
    wrap.appendChild(img);
    wrap.addEventListener('click', () => wrap.remove());
    document.body.appendChild(wrap);
  }

  function typingBubble() {
    const div = document.createElement('div');
    div.className = 'msg is-theirs starts-group ends-group msg-typing-row';
    const dots = document.createElement('span');
    dots.className = 'typing-dots';
    dots.appendChild(document.createElement('i'));
    dots.appendChild(document.createElement('i'));
    dots.appendChild(document.createElement('i'));
    div.appendChild(dots);
    return div;
  }

  /** بنسجّل إننا قرينا — مرة واحدة لكل رسالة جديدة، مش مع كل رندر */
  function markRead() {
    const chat = state.chats.get(state.activeId);
    if (!chat || !db) return;
    const last = state.messages[state.messages.length - 1];
    if (!last || !last.ts) return;
    if (String(last.senderId) === myId()) return;
    if (chat.myReadAt && chat.myReadAt >= last.ts) return;

    chat.myReadAt = last.ts; // تحديث محلي فوري عشان البادج يختفي على طول
    db.ref(Paths.reads(chat.convId, myId())).set(stamp())
      .catch((err) => console.warn('read receipt failed', err && err.code));
    db.ref(Paths.userChat(myId(), chat.id)).update({ myReadAt: stamp(), unread: 0 })
      .catch((err) => console.warn('unread reset failed', err && err.code));
    renderChatList();
  }

  // ============================================================
  // الإرسال
  // ============================================================
  el.composerForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    sendMessage();
  });

  async function sendMessage() {
    const chat = state.chats.get(state.activeId);
    const text = el.composerInput.value.trim();
    if (!chat || !text || !db) return;

    const cid = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    state.pending.set(cid, {
      id: cid, cid, senderId: myId(), text, ts: Date.now(), pending: true,
    });

    el.composerInput.value = '';
    resetComposer();
    renderMessages();
    clearMyTyping();

    try {
      await db.ref(Paths.messages(chat.convId)).push({ senderId: myId(), text, ts: stamp(), cid });
      await writeChatSummaries(chat, text);
    } catch (err) {
      console.error('send failed:', err && err.code, err);
      state.pending.delete(cid);
      el.composerInput.value = text;
      resetComposer();
      renderMessages();
      const denied = err && err.code === 'PERMISSION_DENIED';
      toast(denied ? 'الرسالة ماوصلتش — راجع قواعد الأمان في Firebase' : 'الرسالة ماوصلتش — حاول تاني', 'error');
    }
  }

  // ============================================================
  // إرسال صورة/فيديو
  // ============================================================
  el.attachBtn.addEventListener('click', () => {
    if (!state.activeId) return;
    el.mediaInput.value = '';
    el.mediaInput.click();
  });

  el.mediaInput.addEventListener('change', () => {
    const file = el.mediaInput.files && el.mediaInput.files[0];
    if (file) sendMedia(file);
  });

  /** رفع ملف على Cloudinary مع تتبّع نسبة التقدّم — بيرجّع Promise فيه رابط الملف النهائي */
  /** رفع ملف على Cloudinary (Unsigned Upload) — من غير أي حاجة تتظبط على
   * Vercel خالص، بس اسم الحساب واسم الـ Upload Preset (من ملف الإعدادات).
   * بيرجّع Promise فيه رابط الملف النهائي، وبيبلّغ عن نسبة الرفع أول بأول */
  function uploadToCloudinary(file, folder, onProgress) {
    return new Promise((resolve, reject) => {
      const cfg = window.CLOUDINARY_CONFIG;
      if (!cfg || !cfg.cloudName || !cfg.uploadPreset) {
        reject(new Error('إعدادات Cloudinary مش موجودة — تأكد من ملف cloudinary-client-config.js'));
        return;
      }

      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', cfg.uploadPreset);
      fd.append('folder', folder);

      const xhr = new XMLHttpRequest();
      const isVideo = file.type.startsWith('video/');
      xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + cfg.cloudName + '/' + (isVideo ? 'video' : 'image') + '/upload');
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && onProgress) onProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data);
          else reject(Object.assign(new Error((data.error && data.error.message) || 'رفع الملف فشل (كود ' + xhr.status + ')'), { data }));
        } catch (e) { reject(e); }
      };
      xhr.onerror = () => reject(new Error('مفيش نت — رفع الملف فشل'));
      xhr.send(fd);
    });
  }

  async function sendMedia(file) {
    const chat = state.chats.get(state.activeId);
    if (!chat || !db) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) { toast('الملف ده لازم يكون صورة أو فيديو', 'error'); return; }

    const maxMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (file.size > maxMb * 1024 * 1024) {
      toast('الملف كبير أوي — الحد الأقصى ' + maxMb + ' ميجا', 'error');
      return;
    }

    const caption = el.composerInput.value.trim();
    const text = caption || (isVideo ? '🎥 فيديو' : '📷 صورة');
    const type = isVideo ? 'video' : 'image';

    const cid = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const localUrl = URL.createObjectURL(file);
    state.pendingLocalUrls.set(cid, localUrl);
    state.pending.set(cid, {
      id: cid, cid, senderId: myId(), text, ts: Date.now(), pending: true,
      type, mediaUrl: localUrl, uploadPct: 0,
    });

    el.composerInput.value = '';
    resetComposer();
    renderMessages();

    try {
      // نرفع الملف على Cloudinary مباشرة من المتصفح — مفيش أي خطوة على
      // السيرفر بتاعنا خالص، بس اسم الحساب واسم الـ Upload Preset
      const uploaded = await uploadToCloudinary(file, 'chat-media/' + chat.convId, (pct) => {
        const p = state.pending.get(cid);
        if (p) { p.uploadPct = pct; renderMessages(); }
      });

      // نسجّل الرسالة في Firebase زي أي رسالة تانية، برابط الملف النهائي
      await db.ref(Paths.messages(chat.convId)).push({
        senderId: myId(), text, ts: stamp(), cid, type, mediaUrl: uploaded.secure_url,
      });
      await writeChatSummaries(chat, text);
      // تصليح: كنا بنمسح المعاينة المحلية (blob URL) فورًا هنا، حتى لو
      // النسخة الحقيقية لسه ما وصلتش لشاشتنا (خصوصًا مع نت بطيء) — فكانت
      // الصورة بتتكسر لحظة قبل ما توصل النسخة الحقيقية. دلوقتي بنسيب
      // المعاينة المحلية شغالة، وبنمسحها بس لما نتأكد إن الرسالة الحقيقية
      // وصلت فعلاً (جوه listenMessages).
    } catch (err) {
      console.error('media send failed:', err);
      state.pending.delete(cid);
      const u = state.pendingLocalUrls.get(cid);
      if (u) { URL.revokeObjectURL(u); state.pendingLocalUrls.delete(cid); }
      renderMessages();
      // بنوري رسالة الخطأ الحقيقية على الشاشة عشان تعرف السبب بالظبط من
      // غير ما تحتاج تفتح أدوات المطوّر في المتصفح خالص
      const detail = (err && err.message) ? String(err.message).slice(0, 160) : '';
      toast(detail ? ('الملف ماوصلش: ' + detail) : 'الملف ماوصلش — حاول تاني', 'error');
    }
  }

  /** ملخّص الدردشة عند الطرفين — ده اللي بيظهر في الشاشة الرئيسية */
  async function writeChatSummaries(chat, text) {
    const me = myId();
    const other = String(chat.id);
    const now = stamp();

    await db.ref(Paths.userChat(me, other)).update({
      convId: chat.convId,
      otherName: chat.otherName,
      otherPhone: chat.otherPhone,
      isVerified: !!chat.isVerified,
      isOfficial: !!chat.isOfficial,
      lastMessage: text,
      lastAt: now,
      lastSenderId: me,
      myReadAt: now,
      unread: 0,
    });

    await db.ref(Paths.userChat(other, me)).update({
      convId: chat.convId,
      otherName: state.me.official_display_name || state.me.name || 'مستخدم',
      otherPhone: Phone.canonicalPhone(state.me.phone) || String(state.me.phone || ''),
      isVerified: !!state.me.is_verified,
      isOfficial: !!state.me.is_official,
      lastMessage: text,
      lastAt: now,
      lastSenderId: me,
    });

    // عدّاد الرسايل الجديدة عند الطرف التاني — بالسيرفر عشان ماحتاجش أقرا نودته
    try {
      await db.ref(Paths.userChat(other, me) + '/unread')
        .set(firebase.database.ServerValue.increment(1));
    } catch (err) {
      console.warn('unread increment failed', err && err.code);
    }
  }

  // ============================================================
  // خانة الكتابة — بتكبر لتحت، ومش بتتمدّ على الجناب
  // ============================================================
  function resetComposer() {
    const t = el.composerInput;
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, MAX_COMPOSER_H) + 'px';
    el.sendBtn.disabled = t.value.trim().length === 0;
  }

  el.composerInput.addEventListener('input', () => {
    resetComposer();
    pingTyping();
  });

  el.composerInput.addEventListener('keydown', (ev) => {
    // على الكمبيوتر: Enter يبعت، Shift+Enter سطر جديد.
    // على الموبايل: Enter بيعمل سطر جديد والزر بيبعت (عشان الكلام الطويل ينزل لتحت).
    if (ev.key !== 'Enter' || ev.shiftKey) return;
    if (!matchMedia('(min-width: 900px)').matches) return;
    ev.preventDefault();
    sendMessage();
  });

  el.composerInput.addEventListener('blur', clearMyTyping);

  function pingTyping() {
    const chat = state.chats.get(state.activeId);
    if (!chat || !db) return;
    if (el.composerInput.value.trim().length === 0) { clearMyTyping(); return; }
    const now = Date.now();
    if (now - state.lastTypingPing < TYPING_PING) return;
    state.lastTypingPing = now;
    db.ref(Paths.typing(chat.convId, myId())).set(stamp())
      .catch((err) => console.warn('typing write failed', err && err.code));
  }

  function clearMyTyping() {
    const chat = state.chats.get(state.activeId);
    if (!chat || !db) return;
    state.lastTypingPing = 0;
    db.ref(Paths.typing(chat.convId, myId())).remove()
      .catch(() => { /* مش مهم */ });
  }

  // ============================================================
  // البحث — الرقم الكامل بالظبط بس (خصوصية)
  // ============================================================
  el.newChatBtn.addEventListener('click', () => {
    el.searchPhone.value = '';
    el.searchOut.textContent = '';
    openSheet('newChatModal');
  });

  function searchMsg(text, isError) {
    el.searchOut.textContent = '';
    const p = note('search-msg' + (isError ? ' is-error' : ''), text);
    el.searchOut.appendChild(p);
  }

  el.searchPhone.addEventListener('input', () => {
    // مفيش بحث تلقائي أثناء الكتابة — لازم يضغط "دوّر" برقم كامل
    if (el.searchOut.firstChild) el.searchOut.textContent = '';
  });

  el.searchForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const raw = el.searchPhone.value;

    // نفس رسائل الخطأ اللي السيرفر بيرجّعها — من نفس الملف
    const problem = Phone.phoneError(raw);
    if (problem) { searchMsg(problem, true); return; }

    const canonical = Phone.canonicalPhone(raw);
    if (canonical === Phone.canonicalPhone(state.me.phone)) {
      searchMsg('ده رقمك إنت', true);
      return;
    }

    el.searchBtn.disabled = true;
    el.searchBtn.textContent = 'بيدوّر…';
    searchMsg('بيدوّر…', false);
    try {
      const data = await api('/api/users/search?phone=' + encodeURIComponent(canonical));
      const user = (data.users || [])[0];
      if (!user) {
        searchMsg('مفيش حساب على ملج بالرقم ده', false);
        return;
      }
      renderSearchHit(user);
    } catch (err) {
      searchMsg(err.message, true);
    } finally {
      el.searchBtn.disabled = false;
      el.searchBtn.textContent = 'دوّر';
    }
  });

  function renderSearchHit(user) {
    el.searchOut.textContent = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-hit';

    const avatar = document.createElement('span');
    avatar.className = 'avatar avatar-sm';
    avatar.textContent = Fmt.initials(user.official_display_name || user.name);

    const main = document.createElement('span');
    main.className = 'search-hit-main';
    const name = document.createElement('span');
    name.className = 'search-hit-name';
    name.appendChild(document.createTextNode(user.official_display_name || user.name || 'مستخدم'));
    if (user.is_verified) name.appendChild(svgIcon('verified', CHECK_PATH));
    const phone = document.createElement('span');
    phone.className = 'search-hit-phone';
    phone.dir = 'ltr';
    phone.textContent = Phone.formatPhoneForDisplay(user.phone);
    main.appendChild(name);
    main.appendChild(phone);

    const go = document.createElement('span');
    go.className = 'search-hit-go';
    go.textContent = 'ابدأ الدردشة';

    btn.appendChild(avatar);
    btn.appendChild(main);
    btn.appendChild(go);
    btn.addEventListener('click', () => openChat(user));
    el.searchOut.appendChild(btn);
  }

  // ============================================================
  // البداية
  // ============================================================
  async function boot() {
    el.forgotWhatsapp.href = 'https://wa.me/' + SUPPORT_WHATSAPP;
    resetComposer();

    try { state.token = localStorage.getItem(TOKEN_KEY); } catch (_) { state.token = null; }

    if (!state.token) { showAuth(); return; }

    try {
      const data = await api('/api/auth/me');
      await enterApp(data.user);
    } catch (err) {
      if (!err.offline) clearToken();
      showAuth();
      if (err.offline) toast('مفيش نت — سجّل دخول لما الاتصال يرجع', 'warn');
    }
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* مش مشكلة */ });
    });
  }

  boot();
})();
