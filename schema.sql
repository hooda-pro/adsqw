-- ==========================================
-- Malg App — Database Schema (from scratch)
-- ==========================================

-- جدول المستخدمين الأساسي
CREATE TABLE IF NOT EXISTS users (
  id                    SERIAL PRIMARY KEY,
  phone                 TEXT NOT NULL UNIQUE,          -- رقم الهاتف (يستخدم كـ username)
  password_hash         TEXT NOT NULL,                 -- كلمة السر مشفرة (bcrypt)
  name                  TEXT NOT NULL,                 -- اسم المستخدم الظاهر
  avatar_url            TEXT,                          -- صورة البروفايل
  status_text           TEXT DEFAULT '',               -- الحالة (زي "Available" في واتساب)

  -- توثيق وحسابات رسمية
  is_verified           BOOLEAN NOT NULL DEFAULT false, -- علامة التوثيق ✔️
  is_official           BOOLEAN NOT NULL DEFAULT false, -- حساب رسمي (زي حساب Malg نفسه)
  official_display_name TEXT,                           -- الاسم الظاهر بدل الرقم لو حساب رسمي

  -- الحظر وإدارة الحساب
  banned                BOOLEAN NOT NULL DEFAULT false,
  banned_reason         TEXT,
  banned_at             TIMESTAMPTZ,

  -- حماية تسجيل الدخول
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users (is_verified);

-- جلسات تسجيل الدخول (بدل ما نخزن التوكن في الداتابيز ممكن نستخدم JWT بس ده لو عايزين نقدر نلغي الجلسة من لوحة الأدمن)
CREATE TABLE IF NOT EXISTS sessions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  device_info   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked       BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token_hash);

-- طلبات إعادة تعيين كلمة السر (لما حد ينسى الباسورد ويتواصل واتساب)
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id            SERIAL PRIMARY KEY,
  phone         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending / resolved
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ,
  resolved_by   TEXT -- اسم الأدمن اللي حل الطلب
);

-- سجل أحداث الأدمن (Audit log) - مهم عشان تعرف مين عمل حظر/توثيق/مسح
CREATE TABLE IF NOT EXISTS admin_actions_log (
  id            SERIAL PRIMARY KEY,
  admin_user    TEXT NOT NULL,
  action_type   TEXT NOT NULL, -- ban / unban / verify / unverify / delete / reset_password
  target_user_id INTEGER,
  target_phone  TEXT,
  details       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
