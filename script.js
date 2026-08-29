// script.js
const SUPPORT_WHATSAPP_NUMBER = '201065749774'; // بصيغة دولية من غير + أو أصفار زيادة (مصر: 20 بدل الصفر الأول)

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const tabs = document.querySelectorAll('.tab');
const forms = document.querySelectorAll('.form');
const authShell = document.querySelector('.auth-shell');
const appShell = document.getElementById('appShell');

const forgotBtn = document.getElementById('forgotBtn');
const forgotModal = document.getElementById('forgotModal');
const forgotCancel = document.getElementById('forgotCancel');
const forgotWhatsapp = document.getElementById('forgotWhatsapp');
const forgotPhone = document.getElementById('forgotPhone');

const logoutBtn = document.getElementById('logoutBtn');

// ---------- تبديل التابات ----------
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    forms.forEach((f) => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}Form`).classList.add('active');
  });
});

// ---------- تسجيل الدخول ----------
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
    showApp(data.user);
  } catch (err) {
    errorEl.textContent = 'مقدرش أتواصل مع السيرفر، جرب تاني';
  }
});

// ---------- حساب جديد ----------
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
    showApp(data.user);
  } catch (err) {
    errorEl.textContent = 'مقدرش أتواصل مع السيرفر، جرب تاني';
  }
});

// ---------- نسيت الباسورد ----------
forgotBtn.addEventListener('click', () => {
  forgotModal.hidden = false;
});
forgotCancel.addEventListener('click', () => {
  forgotModal.hidden = true;
});
forgotPhone.addEventListener('input', updateForgotLink);
function updateForgotLink() {
  const phone = forgotPhone.value.trim();
  const msg = encodeURIComponent(`مرحباً، نسيت كلمة السر لحسابي في Malg. رقمي المسجل: ${phone || '.....'}`);
  forgotWhatsapp.href = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${msg}`;
}
updateForgotLink();

// ---------- الجلسة ----------
function saveSession(token, user) {
  localStorage.setItem('malg_token', token);
  localStorage.setItem('malg_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('malg_token');
  localStorage.removeItem('malg_user');
}

function showApp(user) {
  authShell.hidden = true;
  appShell.hidden = false;
  document.getElementById('meName').textContent = user.name;
  document.getElementById('mePhone').textContent = user.phone;
  document.getElementById('meAvatar').textContent = (user.name || '?').charAt(0).toUpperCase();
}

logoutBtn.addEventListener('click', () => {
  clearSession();
  location.reload();
});

// ---------- التحقق من الجلسة عند فتح الصفحة ----------
(async function checkSession() {
  const token = localStorage.getItem('malg_token');
  if (!token) return;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (res.ok) {
      showApp(data.user);
    } else {
      clearSession();
    }
  } catch (err) {
    // مفيش نت أو السيرفر واقع - سيب المستخدم في شاشة الدخول
  }
})();

// ---------- تسجيل الـ Service Worker (PWA) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
