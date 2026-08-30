# Malg (ملج) — تطبيق دردشة عربي

دردشة لحظية بالعربي (RTL) — واجهة PWA فانيلا JS، وباك-إند Vercel Serverless
Functions على Neon Postgres، والرسايل اللحظية على Firebase Realtime Database.

> ⚠️ **بعد أي تحديث للمشروع فيه خطوتين يدويّتين لازم تتعملوا وإلا التطبيق مش
> هيشتغل** — اقرا [خطوتين لازم تتعملوا بإيدك](#خطوتين-لازم-تتعملوا-بإيدك).

## شكل المشروع

```
api/                    نقاط الـ API (Vercel Serverless — CommonJS)
  auth/signup.js        حساب جديد: اسم + رقم + باسورد
  auth/login.js         دخول (قفل مؤقت بعد 5 محاولات غلط)
  auth/me.js            التحقق من الجلسة الحالية
  firebase-token.js     بيبدّل توكن Malg بـ Firebase custom token
  users/search.js       بحث بالرقم الكامل بالظبط (مفيش بحث جزئي)

lib/                    كود مشترك للسيرفر
  auth.js               bcrypt + JWT + هاش التوكن
  db.js                 الاتصال بـ Postgres
  session.js            getUserFromRequest — مصدر واحد للتحقق من الجلسة
  firebase.js           Firebase Admin
  phone.js              re-export لـ public/js/phone.js (نسخة واحدة بس)

public/                 الواجهة
  index.html            الشاشات التلاتة: تحميل / دخول / التطبيق
  style.css             تصميم دارك واحد، فيه نقاط تحوّل للتلفون والكمبيوتر
  js/phone.js           منطق الأرقام (UMD — بيشتغل في المتصفح وفي Node)
  js/format.js          دوال عرض خالصة (تواريخ، تجميع رسايل، معاينة)
  js/paths.js           بناء مسارات Firebase + convId
  js/app.js             ربط الواجهة بالـ API و Firebase
  sw.js                 Service Worker (كاش للملفات، ومفيش كاش للـ API)
  icons/                أيقونات PWA (بتتولّد من tools/make-icons.py)

tests/                  90 اختبار — بيشتغلوا بـ node:test، من غير أي تنزيلات
tools/make-icons.py     مولّد الأيقونات (Python خالص، من غير Pillow)
schema.sql              هيكل قاعدة البيانات
firebase-database-rules.json   قواعد أمان Firebase
_old/                   نسخ قديمة محفوظة — مش جزء من التطبيق
```

## خطوتين لازم تتعملوا بإيدك

الاتنين دول مش بيتعملوا مع `git push` أو نشر Vercel — لازم تفتح لوحات التحكم:

### 1) قواعد أمان Firebase (من غيرها الدردشة مش هتفتح خالص)

القواعد اتغيرت تغيير جوهري: بقت بتشتق «هل أنا طرف في المحادثة دي؟» من الـ id
بتاع المحادثة نفسه، وبقى فيها `presence` و`typing` و`reads`، والأهم إن الـ
`.read` اتحطّ على `userConversations/$uid` — نفس المستوى اللي الواجهة بتسمع
عليه بالظبط. الصلاحيات في Firebase بتنزل لتحت بس، فالمستوى الغلط = صمت تام.

1. افتح [Firebase Console](https://console.firebase.google.com) → مشروعك.
2. **Realtime Database** → تاب **Rules**.
3. امسح اللي فيه كله، والزق محتوى `firebase-database-rules.json` بالكامل.
4. **Publish**.

### 2) شغّل `schema.sql` تاني (عشان جدول حد البحث)

فيه جدول جديد اسمه `search_rate_limit`. الملف كله `CREATE TABLE IF NOT EXISTS`
فبيتشغّل تاني بأمان ومش بيمسح أي بيانات:

1. افتح [Neon](https://neon.tech) → مشروعك → **SQL Editor**.
2. الزق محتوى `schema.sql` كله و**Run**.

> لو نسيت الخطوة دي: البحث هيفضل شغال، بس من غير حد للمحاولات، وهيطلع تحذير
> في اللوجز (`search_rate_limit table missing`) — الكود بيسمح بالبحث بدل إنه
> يكسّره.

## التشغيل المحلي

```bash
npm install
```

```bash
npm test
```

```bash
npm run icons
```

`npm test` بيشغّل 90 اختبار على `node:test` — مفيش أي حزمة اختبار متنزّلة،
ومحتاج Node 18 أو أحدث بس. `npm run icons` بيعيد توليد أيقونات PWA (محتاج
Python، ومش محتاج Pillow — التوليد PNG خام بـ zlib).

## متغيرات البيئة

كلها بتتحط في **Vercel → Settings → Environment Variables** وبس. مفيش ولا
واحدة منهم مكتوبة في الكود (وفيه اختبار بيتأكد من ده):

| المتغير | إيه ده |
|---|---|
| `POSTGRES_URL` | connection string بتاع Neon |
| `JWT_SECRET` | قيمة عشوائية طويلة — بتوقّع بيها التوكنات |
| `FIREBASE_PROJECT_ID` | من ملف service account |
| `FIREBASE_CLIENT_EMAIL` | من ملف service account |
| `FIREBASE_PRIVATE_KEY` | من ملف service account (بالـ `\n` زي ما هو) |
| `FIREBASE_DATABASE_URL` | رابط الـ Realtime Database |

`public/firebase-client-config.js` فيه Web API key — **ده مش سر**، ده معرّف
عام مقصود إنه يبان للمتصفح. الحماية الحقيقية كلها في قواعد الـ Realtime
Database، مش في إخفاء المفتاح ده.

## الـ API

| الطلب | الـ body / الهيدر | الرد |
|---|---|---|
| `POST /api/auth/signup` | `{ phone, password, name }` | `{ user, token }` |
| `POST /api/auth/login` | `{ phone, password }` | `{ user, token }` |
| `GET /api/auth/me` | `Authorization: Bearer <token>` | `{ user }` |
| `GET /api/firebase-token` | `Authorization: Bearer <token>` | `{ token }` (Firebase) |
| `GET /api/users/search?phone=...` | `Authorization: Bearer <token>` | `{ users: [] }` أو `[user]` |

### الخصوصية في البحث

البحث بيقبل **الرقم الكامل الصالح بس**. `010` بيرجع `400` مع رسالة «الرقم
ناقص»، ومابيوصلش للداتابيز أصلًا. مفيش `ILIKE` ولا `%` في أي استعلام،
والنتيجة `LIMIT 1`، وفيه حد **20 بحثة كل 5 دقايق** لكل مستخدم عشان محدش
يقعد يجرّب أرقام واحد ورا التاني. الاختبارات بتتأكد من كل شرط من دول.

## الاختبارات

```bash
npm test
```

| الملف | بيغطّي إيه |
|---|---|
| `phone.test.js` | صيغ الأرقام، ورفض كل رقم ناقص (أساس الخصوصية) |
| `paths.test.js` | `convId` نفسه عند الطرفين، والشخص التالت مش طرف |
| `format.test.js` | التواريخ، تجميع الرسايل، المعاينة، عدّاد الجديد |
| `rules.test.js` | شكل قواعد Firebase — الـ `.read` في مكانه الصح |
| `no-drift.test.js` | مفيش نسختين من نفس الكود يفرقوا عن بعض |
| `wiring.test.js` | كل `id` بيستخدمه `app.js` موجود في `index.html` |
| `api-privacy.test.js` | مفيش بحث جزئي، ومفيش سر مكتوب في الكود |
| `smoke.test.js` | بيشغّل `app.js` فعلًا على DOM مزيّف — البداية مش بترمي |

**بصراحة عن حدود الاختبارات:** `rules.test.js` و`api-privacy.test.js`
و`wiring.test.js` **اختبارات شكل، مش تشغيل**. هي بتقرا الملفات وتتأكد إن
الشروط مكتوبة صح وفي المكان الصح — مش بتشغّل محرّك قواعد Firebase ولا
بتضرب داتابيز حقيقية. اللي بيعمل كده هو Firebase Emulator مع
`@firebase/rules-unit-testing`، وده محتاج Java وحزم إضافية. الاختبارات دي
بتمسك النوع اللي وقّعنا فعلًا (قاعدة في المستوى الغلط، `ILIKE` رجعت تاني،
`id` اتغير في HTML وماتغيّرش في JS) بس مش بديل عن تجربة يدوية على جهازين.

## ملاحظات على التصميم

- **دارك واحد بس** — تباين عالي، زخرفة أقل، مفيش وضع نهاري.
- **تلفون:** لوح واحد بيتبدّل (القائمة ↔ الشات)، وزرار رجوع، وزرار عايم.
- **كمبيوتر (من 900px):** لوحين جنب بعض زي واتساب ويب، والقائمة ثابتة.
- **صندوق الكتابة** `<textarea>` بينزل تحت لغاية 168px وبعد كده بيسكرول —
  مابيفرّحش الصف الأفقي ولا بيهرب من الشاشة.
- **في RTL:** رسايلي على الشمال ورسايل التاني على اليمين (زي واتساب العربي).
- **التواجد حقيقي:** «متصل الآن» / «آخر ظهور ...» جاية من `.info/connected`
  و`onDisconnect` — مش نص ثابت زي الأول، وفيه «بيكتب...» وعلامة القراءة.

## اللي لسه ناقص

- لوحة أدمن (حظر، توثيق، مسح حساب) — الأعمدة موجودة في `schema.sql` بس.
- استرجاع الباسورد لسه بيمشي على واتساب يدوي (مفيش OTP).
- الصور والملفات في الرسايل.
- اختبارات على Firebase Emulator بدل اختبارات الشكل.



