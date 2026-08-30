# Graph Report - malg  (2026-08-30)

## Corpus Check
- Corpus is ~9,922 words - fits in a single context window. You may not need a graph.

## Summary
- 225 nodes · 289 edges · 18 communities (10 shown, 4 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Frontend UI Controller (public)
- Frontend UI Controller (stale root copy)
- Auth & Search API (canonical)
- Product Architecture Concepts
- Crypto & Session Libs (stale root copy)
- Dependency Manifest
- PWA Manifest (stale root copy)
- PWA Manifest (public)
- Firebase Admin Token Issuer
- User Search (stale root copy)
- Login Endpoint (stale root copy)
- Session Check Endpoint (stale root copy)
- Signup Endpoint (stale root copy)
- Vercel Deploy Config

## God Nodes (most connected - your core abstractions)
1. `hashToken()` - 6 edges
2. `{ sql }` - 6 edges
3. `renderChatList()` - 6 edges
4. `renderChatList()` - 6 edges
5. `getUserFromRequest()` - 5 edges
6. `signIntoFirebase()` - 5 edges
7. `searchUsers()` - 5 edges
8. `listenToMessages()` - 5 edges
9. `signIntoFirebase()` - 5 edges
10. `searchUsers()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `RTDB Security Rules` ----> `Chat List Screen (appShell)`  [INFERRED]
  firebase-database-rules.json → public/index.html
- `RTDB Security Rules` ----> `Conversation Screen (chatScreen)`  [INFERRED]
  firebase-database-rules.json → public/index.html
- `Chat List Screen (appShell)` ----> `Verified / Official Accounts`  [EXTRACTED]
  public/index.html → schema.sql
- `Admin Panel (planned)` ----> `Verified / Official Accounts`  [INFERRED]
  SETUP-GUIDE.md → schema.sql
- `Malg App` ----> `PWA Shell`  [EXTRACTED]
  README.md → public/manifest.json

## Import Cycles
- None detected.

## Communities (18 total, 4 thin omitted)

### Community 0 - "Frontend UI Controller (public)"
Cohesion: 0.05
Nodes (47): appShell, authShell, backBtn, chatAvatar, chatList, chatName, chatScreen, chatSearchInput (+39 more)

### Community 1 - "Frontend UI Controller (stale root copy)"
Cohesion: 0.05
Nodes (47): appShell, authShell, backBtn, chatAvatar, chatList, chatName, chatScreen, chatSearchInput (+39 more)

### Community 2 - "Auth & Search API (canonical)"
Cohesion: 0.13
Nodes (22): { comparePassword, normalizePhone, generateToken, hashToken, TOKEN_EXPIRY_DAYS }, { sql }, { sql }, { verifyToken, hashToken }, { hashPassword, normalizePhone, generateToken, hashToken, TOKEN_EXPIRY_DAYS }, { sql }, { getUserFromRequest }, { normalizePhone } (+14 more)

### Community 3 - "Product Architecture Concepts"
Cohesion: 0.16
Nodes (19): Admin Panel (planned), Auth Screen (authShell), Chat List Screen (appShell), Conversation Screen (chatScreen), Firebase Custom Token Auth, Firebase Realtime Database, Forgot Password via WhatsApp, JWT + DB Session Model (+11 more)

### Community 4 - "Crypto & Session Libs (stale root copy)"
Cohesion: 0.17
Nodes (9): bcrypt, crypto, hashToken(), jwt, verifyToken(), { sql }, getUserFromRequest(), { sql } (+1 more)

### Community 5 - "Dependency Manifest"
Cohesion: 0.14
Nodes (13): bcryptjs, firebase-admin, jsonwebtoken, dependencies, bcryptjs, firebase-admin, jsonwebtoken, @vercel/postgres (+5 more)

### Community 6 - "PWA Manifest (stale root copy)"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 7 - "PWA Manifest (public)"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 8 - "Firebase Admin Token Issuer"
Cohesion: 0.40
Nodes (3): { admin }, { getUserFromRequest }, admin

### Community 9 - "User Search (stale root copy)"
Cohesion: 0.50
Nodes (3): { getUserFromRequest }, { normalizePhone }, { sql }

## Knowledge Gaps
- **119 isolated node(s):** `{ sql }`, `{ comparePassword, normalizePhone, generateToken, hashToken, TOKEN_EXPIRY_DAYS }`, `{ sql }`, `{ verifyToken, hashToken }`, `{ sql }` (+114 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 135 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `{ sql }`, `{ comparePassword, normalizePhone, generateToken, hashToken, TOKEN_EXPIRY_DAYS }`, `{ sql }` to the rest of the system?**
  _119 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend UI Controller (public)` be split into smaller, more focused modules?**
  _Cohesion score 0.05411764705882353 - nodes in this community are weakly interconnected._
- **Should `Frontend UI Controller (stale root copy)` be split into smaller, more focused modules?**
  _Cohesion score 0.05411764705882353 - nodes in this community are weakly interconnected._
- **Should `Auth & Search API (canonical)` be split into smaller, more focused modules?**
  _Cohesion score 0.1330049261083744 - nodes in this community are weakly interconnected._
- **Should `Dependency Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._