// tests/smoke.test.js
// بيشغّل app.js فعلًا في Node على DOM مزيّف بسيط، عشان نتأكد إن مسار البداية
// (boot → مفيش توكن → شاشة الدخول) مابيرميش أي خطأ. ده اختبار تشغيل حقيقي مش
// اختبار شكل، لكنه بيغطّي البداية بس — مش الشات ولا Firebase (دول محتاجين
// متصفح ونت). فايدته إنه بيمسك الأخطاء اللي بتموّت الصفحة كلها قبل ما تبان:
// عنصر مش موجود، دالة مكتوبة غلط، خطأ في وقت التحميل.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const REAL_IDS = new Set([...HTML.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

/** عنصر مزيّف — بيسجّل كل حاجة بتتعمل عليه من غير ما يرمي */
function makeEl(tag = 'div', id = '') {
  const el = {
    tagName: String(tag).toUpperCase(),
    id,
    _children: [],
    _listeners: {},
    _attrs: {},
    style: {},
    dataset: {},
    textContent: '',
    value: '',
    href: '',
    disabled: false,
    hidden: false,
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    checked: false,
    classList: {
      _set: new Set(),
      add(...c) { c.forEach((x) => this._set.add(x)); },
      remove(...c) { c.forEach((x) => this._set.delete(x)); },
      toggle(c, on) { if (on === undefined) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); } else if (on) this._set.add(c); else this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
  };
  Object.defineProperty(el, 'className', {
    get() { return [...el.classList._set].join(' '); },
    set(v) { el.classList._set = new Set(String(v).split(/\s+/).filter(Boolean)); },
  });
  Object.defineProperty(el, 'innerHTML', { get() { return ''; }, set() { el._children = []; } });
  el.appendChild = (c) => { el._children.push(c); return c; };
  el.append = (...cs) => { el._children.push(...cs); };
  el.prepend = (c) => { el._children.unshift(c); return c; };
  el.removeChild = (c) => { el._children = el._children.filter((x) => x !== c); return c; };
  el.remove = () => {};
  el.replaceChildren = (...cs) => { el._children = cs; };
  el.insertBefore = (c) => { el._children.unshift(c); return c; };
  el.setAttribute = (k, v) => { el._attrs[k] = String(v); };
  el.getAttribute = (k) => (k in el._attrs ? el._attrs[k] : null);
  el.removeAttribute = (k) => { delete el._attrs[k]; };
  el.addEventListener = (t, fn) => { (el._listeners[t] = el._listeners[t] || []).push(fn); };
  el.removeEventListener = () => {};
  el.querySelector = () => makeEl('input');
  el.querySelectorAll = () => [];
  el.closest = () => null;
  el.focus = () => {};
  el.blur = () => {};
  el.scrollIntoView = () => {};
  el.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 });
  Object.defineProperty(el, 'firstChild', { get() { return el._children[0] || null; } });
  Object.defineProperty(el, 'lastChild', { get() { return el._children[el._children.length - 1] || null; } });
  Object.defineProperty(el, 'children', { get() { return el._children; } });
  Object.defineProperty(el, 'childNodes', { get() { return el._children; } });
  return el;
}

function makeSandbox() {
  const nodes = new Map();
  for (const id of REAL_IDS) nodes.set(id, makeEl('div', id));
  const body = makeEl('body');
  const store = new Map();
  const missing = [];

  const document = {
    body,
    documentElement: makeEl('html'),
    getElementById(id) {
      if (nodes.has(id)) return nodes.get(id);
      missing.push(id); // app.js دوّر على id مش موجود في index.html
      return null;
    },
    createElement: (t) => makeEl(t),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
    createDocumentFragment: () => makeEl('fragment'),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    readyState: 'complete',
    hidden: false,
    title: '',
  };

  const sandbox = {
    document,
    console: { log() {}, warn() {}, error() {}, info() {} },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
    navigator: { onLine: true, userAgent: 'node-smoke-test' },
    location: { href: 'http://localhost/', pathname: '/', origin: 'http://localhost', hash: '' },
    history: { pushState() {}, replaceState() {}, back() {} },
    matchMedia: (q) => ({ matches: /min-width:\s*900px/.test(q), addEventListener() {}, addListener() {} }),
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    // مفيش سيرفر — أي طلب بيفشل، وده بالظبط اللي عايزين نتأكد إنه مايكسّرش الصفحة
    fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    firebase: undefined,
    JSON, Math, Date, Promise, Map, Set, Object, Array, String, Number, Boolean,
    Error, TypeError, RegExp, isNaN, parseInt, parseFloat,
    encodeURIComponent, decodeURIComponent, URL, URLSearchParams, Intl,
    _missing: missing,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.addEventListener = () => {};
  return sandbox;
}

function loadApp() {
  const sandbox = makeSandbox();
  const ctx = vm.createContext(sandbox);
  for (const f of ['phone.js', 'format.js', 'paths.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), ctx, { filename: f });
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'js', 'app.js'), 'utf8'), ctx, { filename: 'app.js' });
  return sandbox;
}

test('الملفات التلاتة بتسجّل نفسها على window قبل app.js', () => {
  const sandbox = makeSandbox();
  const ctx = vm.createContext(sandbox);
  for (const f of ['phone.js', 'format.js', 'paths.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), ctx, { filename: f });
  }
  assert.strictEqual(typeof sandbox.MalgPhone, 'object');
  assert.strictEqual(typeof sandbox.MalgFormat, 'object');
  assert.strictEqual(typeof sandbox.MalgPaths, 'object');
  assert.strictEqual(typeof sandbox.MalgPhone.canonicalPhone, 'function');
});

test('app.js بيتحمّل ويشغّل boot من غير ما يرمي', () => {
  const sandbox = loadApp();
  assert.deepStrictEqual(sandbox._missing, [],
    'app.js دوّر على عناصر مش موجودة في index.html: ' + sandbox._missing.join(', '));
});

test('من غير توكن محفوظ، الشاشة بتروح على تسجيل الدخول', async () => {
  const sandbox = loadApp();
  await new Promise((r) => setTimeout(r, 30)); // boot غير متزامنة
  assert.strictEqual(sandbox.document.body.dataset.view, 'auth',
    'المفروض شاشة الدخول لما مفيش توكن');
});

test('لو فيه توكن والسيرفر مش رادّ، الشاشة مابتعلّقش على "بيحمّل"', async () => {
  const sandbox = makeSandbox();
  sandbox.localStorage.setItem('malg_token', 'fake-token');
  const ctx = vm.createContext(sandbox);
  for (const f of ['phone.js', 'format.js', 'paths.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8'), ctx, { filename: f });
  }
  await new Promise((r) => setTimeout(r, 60));
  assert.notStrictEqual(sandbox.document.body.dataset.view, 'loading',
    'فشل الشبكة مالازمش يخلّي المستخدم على شاشة تحميل للأبد');
  assert.strictEqual(sandbox.document.body.dataset.view, 'auth');
});

test('رابط الدعم على واتساب اتظبط', () => {
  const sandbox = loadApp();
  const link = sandbox.document.getElementById('forgotWhatsapp');
  assert.match(link.href, /^https:\/\/wa\.me\/\d+$/, 'رابط واتساب بشكل غلط: ' + link.href);
});
