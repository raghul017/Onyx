# 🛡️ Onyx — Build Progress Log

> Full history of what has been built, when, and what's left.
> Updated: 2026-06-23 (UI redesign — landing + app pages)

---

## 📊 Overall Status

| Layer | Status |
|-------|--------|
| Core attack engine | ✅ Complete |
| Auth & security | ✅ Complete |
| Billing & subscriptions | ✅ Complete |
| Severity scoring & PDF reports | ✅ Complete |
| Domain ownership verification | ✅ Complete (Jun 17) |
| Multi-tenancy / org model | ✅ Complete (Jun 17) |
| UI redesign (landing + app pages) | ✅ Complete (Jun 23) |
| Public REST API + API keys | ⬜ Not started |
| Scheduled scanning | ⬜ Not started |
| Audit logging | ⬜ Not started |

---

## ✅ Phase 1 — Foundation (Feb 28 – Mar 2, 2026)

### What was built

**Project scaffolding**
- Vite + React + TypeScript + Tailwind + shadcn/ui frontend
- Express + TypeScript backend
- Prisma ORM connected to Neon PostgreSQL (serverless)
- Redis via Docker (`docker compose up redis -d`)
- Deployed: Vercel (frontend) + Render (backend)

**Core attack engine**
- `openapi-parser.ts` — Fetches and parses Swagger 2.0 + OpenAPI 3.x specs via `swagger-parser`. Extracts all endpoints (GET/POST/PUT/DELETE/PATCH) with request body schemas and parameters.
- `ai-payload.ts` — Sends each endpoint to **Gemini 2.5 Flash** with a senior pentester persona prompt. Returns 20 schema-aware payloads per endpoint covering 8 attack types. Falls back to 35 hard-coded payloads if Gemini is unavailable.
- `chaos-queue.ts` / `producer.ts` — BullMQ queue backed by Redis. `addBulk()` dispatches all attack jobs atomically.
- `worker.ts` — 5 concurrent workers, 10 jobs/sec rate limit, 10s job timeout. Fires HTTP payloads at target API, records status code + latency + response snippet.
- `ws-manager.ts` — WebSocket singleton. Clients subscribe to a `testRunId` room; each completed attack is broadcast live.
- `test-run.controller.ts` — Full async pipeline: validate → SSRF check → create DB record → return 201 → async: parse spec → generate payloads → enqueue → attack.

**Authentication**
- JWT (7-day expiry), bcrypt password hashing (8 rounds)
- `POST /api/auth/signup` + `POST /api/auth/signin`
- `authenticateToken` middleware injects `req.user`
- WebSocket auth via `?token=` query param
- Server hard-crashes on boot if `JWT_SECRET` is missing

**Security layers**
- `ssrf-guard.ts` — DNS-resolving SSRF blocker. Rejects any URL resolving to `127.x`, `10.x`, `172.16-31.x`, `192.168.x`, `169.254.x`, `0.x`, `.local`, `.internal`, `::1`.
- WAF bypass on OpenAPI fetch — spoofs Chrome macOS User-Agent to bypass Cloudflare bot detection
- `express-rate-limit` — auth endpoints: 5 req/min, attack endpoints: 5 req/hr per IP
- `helmet` — security headers

**Frontend pages built**
- `Landing.tsx` — marketing homepage with hero, feature grid, tech stack, FAQ, pricing
- `Dashboard.tsx` — command center with URL input, live WebSocket telemetry, 4 metric cards, attack log table
- `History.tsx` — paginated list of all past test runs
- `Report.tsx` — individual test run detail page
- `SignIn.tsx` / `SignUp.tsx` — auth forms with cold-start banner

**DB schema (initial)**
```
User → TestRun → TargetEndpoint → AttackLog
```

**Infrastructure**
- Vercel CI/CD auto-deploy on push to `main`
- Render auto-deploy for backend
- Vercel Analytics + Speed Insights integrated
- Cold-start banner for Render spin-up delay
- SPA routing fix (`vercel.json`) 
- REDIS_URL fallback parsing for Render/Upstash

**Key commits**
- `b331aa1` Jan 01 — Project template
- `b45d636` Feb 28 — ChaosForge dashboard built
- `b3df177` Mar 01 — Gemini AI integration, Onyx rebrand
- `5c3e178` Mar 01 — Dashboard rebuilt as Command Center with Zustand store
- `a6f6d29` Mar 14 — Rate limiting + SSRF guard security patch
- `4f2d1af` Mar 02 — Production deployment (Vercel + Render)
- `92107cb` Apr 25 — Frontend audit: perf, validation, UX, code quality

---

## ✅ Phase 2 — Billing & Monetisation (May 7–8, 2026)

### What was built

**Razorpay subscription billing**
- `razorpay.service.ts` — SDK singleton with lazy-init (prevents crash if env var missing)
- `billing.service.ts` — creates/cancels Razorpay subscriptions
- `billing.routes.ts` — 4 endpoints:
  - `POST /api/billing/subscribe` — creates subscription, returns checkout URL
  - `POST /api/billing/verify` — fetches subscription from Razorpay API directly, writes plan to DB without waiting for webhook
  - `POST /api/billing/cancel` — cancels subscription, downgrades to FREE
  - `POST /api/billing/webhook` — HMAC-SHA256 verified handler for: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `payment.failed`

**Plan tiers**
| Plan | Test Runs/mo | Endpoints/run |
|------|-------------|--------------|
| FREE | 5 | 10 |
| PRO | 100 | 50 |
| TEAM | 500 | Unlimited |
| ENTERPRISE | Unlimited | Unlimited |

**Quota enforcement**
- `quota.middleware.ts` — checks calendar-month usage against plan limits before every test run
- Returns `429 QUOTA_EXCEEDED` with `upgradeUrl: "/billing"`

**Frontend billing UI**
- `Billing.tsx` — plan comparison cards, Razorpay checkout modal, subscription management
- Upgrade buttons always visible regardless of auth load state (fixed: used `user?.plan ?? "FREE"`)
- Pricing in USD ($0 / $9 / $18 per month) with INR secondary note (₹900 / ₹1800 /mo)

**PDF report export**
- `pdf.service.ts` — PDFKit-generated branded report
- Sections: header, executive summary (score + severity breakdown + metrics), full attack results table sorted by severity, paginated footer
- Gated: PRO+ plans only (`GET /api/test-runs/:id/export/pdf`)

**Prisma schema additions**
```prisma
User {
  plan           Plan     @default(FREE)
  razorpaySubId  String?
  planExpiresAt  DateTime?
}
```

**Key commits**
- `ffc3940` May 07 — Razorpay billing: subscriptions, quota, billing UI
- `45a7e3f` May 08 — PDF report export + Razorpay modal checkout
- `99e75e9` May 11 — Fix billing buttons + USD/INR pricing
- `00e0c46` May 13 — Fix: activate plan immediately via `/verify` without webhook dependency

---

## ✅ Phase 3 — CVSS Severity Scoring (May 11, 2026)

### What was built

**`severity.ts` — CVSS-inspired scoring algorithm**

Per-log severity classification:
| Condition | Severity |
|-----------|----------|
| 500+ status + injection/sqli/auth attack type | CRITICAL |
| Response contains password/token/secret/DB error | CRITICAL |
| Any 500+ status | HIGH |
| 401/403 with auth/bypass attack type | HIGH |
| 4xx + info-leak keywords (error/exception/stack/trace) | MEDIUM |
| Generic 4xx | LOW |
| 2xx, 3xx, or no status | INFO |

**Overall security score (0–100)**
- Starts at 100, deductions per finding: CRITICAL −25, HIGH −15, MEDIUM −8, LOW −3
- Score label: CRITICAL (0–25), HIGH (26–50), MEDIUM (51–75), LOW (76–99), CLEAN (100)

**Wired across full stack**
- `test-run.controller.ts` — `GET /api/test-runs` and `GET /api/test-runs/:id` compute and return `overallScore`, `scoreLabel`, `severityBreakdown`
- `History.tsx` — security score column with colour-coded chip per run
- `Report.tsx` — severity filter tabs, score display, semantic row colouring by severity
- `pdf.service.ts` — severity breakdown table + overall score in executive summary

**Key commit**
- `c0448d9` May 11 — CVSS-based severity scoring across full stack

---

## ✅ Phase 4 — Domain Ownership Verification (Jun 17, 2026)

### What was built

**Why:** Without this, any user could point Onyx at any API they don't own — a direct legal liability.

**How it works**
1. User pastes OpenAPI URL → "Verify Domain" button appears inline in Dashboard
2. `POST /api/verify-target` → server generates `onyx-verify-<40hex>` token, stores in DB
3. User places token at `https://domain/.well-known/onyx-verify.txt` **or** as DNS TXT record `_onyx-verify.<domain>`
4. User clicks "Check Verification" → server probes file first, DNS as fallback
5. On success: `verifiedAt` stamped, Execute Run button unlocks
6. If URL domain changes: verification resets automatically
7. Returning users: pre-checks verified domains on Dashboard load — no re-verify needed

**New files**
- `server/src/services/domain-verify.service.ts` — `generateVerificationToken()`, `extractDomain()`, `probeFileMethod()` (HTTPS → HTTP fallback), `probeDnsMethod()`, `verifyDomain()`
- `server/src/controllers/domain-verify.controller.ts` — `initiateVerification`, `checkVerification`, `listVerifiedTargets`, `deleteVerifiedTarget`
- `client/src/components/DomainVerifyPanel.tsx` — inline panel: idle → pending (file/DNS tabs, copy token button) → verified state

**New routes**
```
POST   /api/verify-target         — generate token
POST   /api/verify-target/check   — probe + confirm
GET    /api/verify-target         — list user's verified domains
DELETE /api/verify-target/:id     — remove a record
```

**Gate added to `createTestRun`**
- Checks `VerifiedTarget` for matching `userId + domain` with `verifiedAt != null`
- Returns `403 DOMAIN_NOT_VERIFIED` with domain name if unverified
- Covers both `POST /api/test-runs` and `POST /api/attack` (both delegate to same handler)

**Prisma schema addition**
```prisma
model VerifiedTarget {
  id         String    @id @default(uuid())
  userId     String
  domain     String
  token      String    @unique
  verifiedAt DateTime?
  createdAt  DateTime  @default(now())
  @@unique([userId, domain])
}
```

**Key commit**
- `d27ef2e` Jun 17 — feat: add domain ownership verification before scanning

---

## ✅ Phase 5 — Organization / Multi-Tenancy (Jun 17, 2026)

### What was built

**Why:** Without this, a "Team" subscription was just a higher quota on a single user — no shared workspace, no RBAC, no member management.

**How it works**
1. User creates an org from Settings page — gets an auto-generated slug, becomes OWNER
2. OWNER/ADMIN can invite members by email — server returns a copy-link invite URL (no SMTP required)
3. Invitee visits `/invite/accept?token=<token>` — logs in if needed, joins org with assigned role
4. OrgSwitcher dropdown in Dashboard header lets user toggle between Personal and org contexts
5. When an org is active (`x-org-id` header injected), all test runs, quotas, and plan limits are org-scoped
6. OWNER deletes org → all members lose access; existing test runs have `orgId` set to null (preserved)

**RBAC roles**
| Role | Can do |
|------|--------|
| OWNER | Everything — delete org, manage all members, change roles |
| ADMIN | Invite members, revoke invites, view members |
| VIEWER | View org test runs only |

**New files**
- `server/src/services/org.service.ts` — `createOrg`, `getOrgsForUser`, `createInvite`, `acceptInvite` (expiry + used checks), `listMembers`, `updateMemberRole`, `removeMember`, `guardLastOwner`, `deleteOrg`, `getEffectivePlan`
- `server/src/middleware/org.middleware.ts` — `injectOrgContext` (reads `x-org-id` header), `requireOrgMember(minRole)` factory with `OWNER:3 > ADMIN:2 > VIEWER:1` rank
- `server/src/controllers/org.controller.ts` — 12 handlers (orgs, members, invites, accept)
- `server/src/routes/org.routes.ts` — all 12 routes wired with per-route RBAC
- `client/src/store/useOrgStore.ts` — Zustand persisted store for active org context
- `client/src/components/OrgSwitcher.tsx` — hover dropdown: Personal + org list with roles + "Create organization" link
- `client/src/pages/Settings.tsx` — full org management UI: create org, member table with role editor, invite-by-email (copy-link), pending invites list, danger-zone delete
- `client/src/pages/InviteAccept.tsx` — reads `?token=`, calls `acceptInvite`, handles expired/used errors; unauthenticated users redirect to `/signin` then back

**Modified files**
- `server/src/types/express.d.ts` — added `orgMember?: OrgMember` and `orgId?: string` to `Request`
- `server/src/middleware/quota.middleware.ts` — monthly count now scoped to org when `orgId` present; `getEffectivePlan(userId, orgId)` — org plan overrides user plan
- `server/src/controllers/test-run.controller.ts` — `getAllTestRuns` scoped to org, `createTestRun` stores `orgId`, `deleteTestRun` allows org members
- `server/src/routes/index.ts` — org router mounted, `injectOrgContext` on test-run routes, `/user/me` returns `orgs[]` with role
- `client/src/services/api.ts` — interceptor injects `x-org-id`, all org CRUD functions + `OrgSummary` / `OrgMember` / `OrgInvite` types, `CurrentUser.orgs` field
- `client/src/pages/Dashboard.tsx` — OrgSwitcher + Settings link added to header
- `client/src/App.tsx` — lazy routes for `/settings` and `/invite/accept`

**New routes**
```
GET    /api/orgs                          — list my orgs
POST   /api/orgs                          — create org (caller becomes OWNER)
GET    /api/orgs/:orgId                   — get org detail (VIEWER+)
PATCH  /api/orgs/:orgId                   — update org name (OWNER)
DELETE /api/orgs/:orgId                   — delete org (OWNER)
GET    /api/orgs/:orgId/members           — list members (VIEWER+)
PATCH  /api/orgs/:orgId/members/:userId   — update member role (OWNER)
DELETE /api/orgs/:orgId/members/:userId   — remove member (OWNER)
POST   /api/orgs/:orgId/invites           — create invite link (ADMIN+)
GET    /api/orgs/:orgId/invites           — list pending invites (ADMIN+)
DELETE /api/orgs/:orgId/invites/:id       — revoke invite (ADMIN+)
POST   /api/invites/accept                — accept invite by token (any authed user)
```

**Prisma schema additions**
```prisma
enum OrgRole { OWNER ADMIN VIEWER }

model Organization {
  id             String      @id @default(uuid())
  name           String
  slug           String      @unique
  plan           Plan        @default(FREE)
  razorpaySubId  String?
  planExpiresAt  DateTime?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  members        OrgMember[]
  invites        OrgInvite[]
  testRuns       TestRun[]
}

model OrgMember {
  id       String   @id @default(uuid())
  orgId    String
  userId   String
  role     OrgRole  @default(VIEWER)
  joinedAt DateTime @default(now())
  @@unique([orgId, userId])
}

model OrgInvite {
  id         String    @id @default(uuid())
  orgId      String
  email      String
  role       OrgRole   @default(VIEWER)
  token      String    @unique
  createdBy  String
  acceptedAt DateTime?
  expiresAt  DateTime
  createdAt  DateTime  @default(now())
}
```
TestRun additions: `orgId String?` with `onDelete: SetNull` (preserves runs when org deleted)

**Key facts**
- Invite tokens use `crypto.randomUUID()`, expire after 7 days
- `getEffectivePlan(userId, orgId)` — org plan always overrides personal plan
- Invite URL built from `CLIENT_URL` env var — no SMTP, pure copy-link
- `x-org-id` header is opt-in — all existing personal flows unaffected (backward compatible)

---

## ✅ Phase 6 — UI Redesign (Jun 23, 2026)

### What was built

A full visual redesign unifying the marketing site and the authed app under one theme (Axion-inspired layout + animated gradient accents), with no logic changes — every data flow, WebSocket wire, and payment path preserved.

**Landing page**
- Hero converted to bottom-anchored Axion layout with the WebGL `ShaderBackground` gradient (teal/orange/slate-blue sphere)
- New sections in narrative order: **01 Introducing Onyx** (About), **02 How it works** (Key-Benefits 3-card layout w/ video), **03 Features** (bento), **04 Pricing**
- New `FaqCta` (FAQ accordion + animated `c5-animated-gradient` CTA card) and redesigned newsletter-style `Footer`
- Removed unverifiable content (fake stats, "used by 10+ countries" bar) and the old `SupportedTech` "Built with" section
- Shared `RollButton` (text-roll hover + rotating arrow); pill buttons everywhere
- Standardized all sections to `max-w-[1280px]` + `px-5 sm:px-8 lg:px-12`, uniform `py-16/20/24` rhythm

**Auth pages (SignIn / SignUp)**
- Aurora-style two-column layout: `ShaderBackground` hero panel + form, social buttons, eye toggle, `StepItem` onboarding list
- Onyx-branded copy, IST not London on the navbar clock

**App pages (Dashboard / Billing / History)**
- New shared `AppHeader` — one consistent nav (Onyx wordmark, active-state links, OrgSwitcher/Settings/Billing) across all three
- **Dashboard:** full-width, top nav + dedicated launch panel + rounded card telemetry + live-stream panel; gradient accent; pill inputs/buttons
- **Billing:** full-width, gradient Pro card (frosted inner panel), pill buttons, Satoshi heading — Razorpay flow untouched
- **History:** swapped landing Navbar → AppHeader, rounded audit table, pill score chips, Satoshi heading
- Tokens unified to `#0A0A0A` cards / `#1A1A1A` borders / `white/70` muted text; Satoshi display headings to match landing
- `ShaderBackground` perf: `pixelDensity={1}`, `lazyLoad`, pauses when scrolled off-screen

**New components**
- `client/src/components/AppHeader.tsx` — shared authed-app nav
- `client/src/components/RollButton.tsx` — text-roll CTA
- `client/src/components/ShaderBackground.tsx` — WebGL gradient
- `client/src/components/AboutSection.tsx`, `HowItWorks.tsx`, `FaqCta.tsx`

**Infra fix (same day)**
- `/health` moved above the global-auth org router so health checks return 200 (was 401 → "Server unreachable")
- `useServerStatus` health URL hardened to strip a trailing `/api`

---

## 🗂️ Current File Tree

```
Onyx/
├── client/src/
│   ├── components/
│   │   ├── DomainVerifyPanel.tsx    ← Jun 17: domain ownership verification UI
│   │   ├── OrgSwitcher.tsx          ← Jun 17: org/personal context switcher
│   │   ├── ColdStartBanner.tsx
│   │   ├── ChaosStream.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── ui/                      ← shadcn/ui primitives
│   ├── pages/
│   │   ├── Landing.tsx              ← marketing homepage
│   │   ├── Dashboard.tsx            ← main attack interface + OrgSwitcher
│   │   ├── History.tsx              ← test run history
│   │   ├── Report.tsx               ← individual run detail
│   │   ├── Billing.tsx              ← subscription management
│   │   ├── Settings.tsx             ← Jun 17: org management (create/members/invites)
│   │   ├── InviteAccept.tsx         ← Jun 17: token-based invite acceptance
│   │   ├── SignIn.tsx / SignUp.tsx
│   │   └── LandingPage/             ← Hero, FeatureGrid, TechStack, FAQ, Navbar
│   ├── services/api.ts              ← all HTTP + billing + verify + org API calls
│   ├── store/
│   │   ├── useAttackStore.ts        ← WebSocket + attack state (Zustand)
│   │   ├── useAuthStore.ts          ← JWT token persistence
│   │   ├── useOrgStore.ts           ← Jun 17: active org context (Zustand persisted)
│   │   └── useServerStatus.ts
│   └── App.tsx                      ← routing (+ /settings, /invite/accept)
│
└── server/src/
    ├── controllers/
    │   ├── auth.controller.ts
    │   ├── test-run.controller.ts   ← pipeline + domain gate + org-scoped queries
    │   ├── domain-verify.controller.ts  ← Jun 17: file + DNS probe
    │   └── org.controller.ts            ← Jun 17: 12 handlers for orgs/members/invites
    ├── services/
    │   ├── ai-payload.ts            ← Gemini 2.5 Flash
    │   ├── openapi-parser.ts        ← Swagger/OAS parsing
    │   ├── pdf.service.ts           ← PDFKit branded reports
    │   ├── billing.service.ts       ← Razorpay wrappers
    │   ├── razorpay.service.ts      ← SDK singleton
    │   ├── domain-verify.service.ts ← Jun 17: file probe + DNS TXT verification
    │   └── org.service.ts           ← Jun 17: org CRUD + invite + getEffectivePlan
    ├── queues/
    │   ├── chaos-queue.ts           ← BullMQ queue config
    │   ├── producer.ts              ← addBulk() dispatcher
    │   └── worker.ts                ← 5 concurrent, 10/sec, 10s timeout
    ├── middleware/
    │   ├── auth.ts                  ← JWT verify
    │   ├── quota.middleware.ts      ← org-aware plan limits per calendar month
    │   └── org.middleware.ts        ← Jun 17: injectOrgContext + requireOrgMember
    ├── lib/
    │   ├── prisma.ts
    │   └── ssrf-guard.ts            ← DNS-resolving SSRF blocker
    ├── routes/
    │   ├── index.ts                 ← all routes registered
    │   ├── auth.ts
    │   ├── billing.routes.ts
    │   └── org.routes.ts            ← Jun 17: 12 org routes with RBAC
    ├── types/
    │   ├── shared.ts                ← WebSocket message types
    │   └── express.d.ts             ← Request extended with user, orgMember, orgId
    ├── utils/severity.ts            ← CVSS-inspired scoring
    ├── validators/schemas.ts        ← Zod schemas
    └── websockets/ws-manager.ts     ← WS lifecycle + broadcasting
```

---

## 📦 Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion |
| State | Zustand (attack store, auth store, org store) |
| Backend | Express.js, TypeScript, Node.js |
| Database | PostgreSQL via Neon (serverless), Prisma ORM v7 |
| Queue | BullMQ v5, Redis (Docker) |
| WebSockets | `ws` library (native Node) |
| AI | Google Gemini 2.5 Flash (`@google/genai`) |
| Auth | JWT (7-day), bcrypt |
| Billing | Razorpay subscriptions + webhooks |
| PDF | PDFKit |
| Security | Helmet, express-rate-limit, custom SSRF guard |
| Validation | Zod |
| Deployment | Vercel (frontend), Render (backend) |
| CI | GitHub Actions (typecheck + prisma generate) |

---

## ⬜ What's Next (Priority Order)

### Next: #3 — Public REST API + API Keys
**Why:** Lets Onyx run inside GitHub Actions on every PR — the developer viral growth loop.

**What to build:**
- `ApiKey` model (hashed key, label, lastUsedAt)
- `/v1/` route prefix with API key auth middleware
- Settings page for key generation (show once, then hash)
- `POST /v1/test-runs`, `GET /v1/test-runs/:id`

---

### Month 2–3: Enterprise Readiness
- Audit logging (`AuditLog` model — who ran what, from where, when)
- Shared report links (public read-only URL per run)
- Slack webhook notifications on CRITICAL findings
- Responsible disclosure `/security` page + ToS

### Month 4–5: Growth Engine  
- CLI tool: `npx onyx-scan https://api.example.com/openapi.json`
- GitHub Actions integration (scan on PR, block merge on CRITICAL)
- Scheduled/recurring scans (cron jobs)
- JSON/CSV/SARIF export formats

### Month 6+: Depth & Retention
- Diff view: compare two runs side-by-side ("3 new vulns since last scan")
- Custom payload templates (YAML import/export)
- Onboarding flow with guided first scan (PetStore demo)
- SOC 2 Type II readiness audit

---

## 📈 Commit Timeline

| Date | Commit | What shipped |
|------|--------|--------------|
| Jan 01 | `b331aa1` | Project template |
| Feb 28 | `b45d636` | Dashboard built (ChaosForge) |
| Feb 28 | `d389cbe` | Onyx Mirai UI overhaul |
| Mar 01 | `b3df177` | Gemini AI + Onyx rebrand + WORKFLOW docs |
| Mar 01 | `5c3e178` | Dashboard → Command Center + Zustand |
| Mar 01 | `0b7dc0c` | History page + delete |
| Mar 02 | `4f2d1af` | Production deploy (Vercel + Render) |
| Mar 05 | `c051bb1` | Security patch (CRITICAL + HIGH vulns) |
| Mar 05 | `aef2393` | Render cold-start banner |
| Mar 05 | `1209fe3` | Code splitting, mobile responsive, SEO |
| Mar 14 | `a6f6d29` | Rate limiting + SSRF guards |
| Mar 16 | `c83aa5c` | Vercel Speed Insights |
| Apr 25 | `92107cb` | Frontend audit: perf, UX, validation |
| May 07 | `ffc3940` | **Razorpay billing + quota system** |
| May 08 | `45a7e3f` | **PDF report export** |
| May 08 | `e473e79` | Landing page: social proof, stats, pricing |
| May 11 | `97b4efe` | README rewrite + GitHub CI workflows |
| May 11 | `c0448d9` | **CVSS severity scoring (full stack)** |
| May 11 | `99e75e9` | Fix billing buttons + USD/INR pricing |
| May 13 | `00e0c46` | Fix: immediate plan activation (no webhook wait) |
| Jun 17 | `d27ef2e` | **Domain ownership verification** |
| Jun 17 | —         | **Organization / multi-tenancy (Feature #2)** |
