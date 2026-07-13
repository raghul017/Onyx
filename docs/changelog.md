# Onyx — Changelog & Roadmap

> AI-Powered API Security Testing Platform  
> Live at: https://onyx-engine.vercel.app  
> Backend: https://onyx-server-a38v.onrender.com  
> GitHub: https://github.com/raghul017/Onyx

---

## ⚡ Backend performance + explained findings (Jul 13, 2026)

A performance-and-depth pass on the server, all backward-compatible.

**Performance**

- **SSRF DNS cache** — a scan fires hundreds of payloads at one host; the SSRF
  guard now memoizes the safe/blocked verdict per hostname (60s TTL), collapsing
  ~400 identical `dns.lookup` calls into one per run. Also fixed a pre-existing
  bypass: bracketed IPv6 literals (`[::1]`, `[::ffff:10.0.0.1]`, incl. the
  hex-normalized `::ffff:a00:1`) are now blocked. (`ee08ef4`)
- **Connection pool** — raised the Prisma pg pool `max` 10 → 20 so the BullMQ
  worker (concurrency 12) can't starve the pool it shares with the HTTP server.
- **Per-attack hot path** — `attackLog.create` + the progress `increment` run in
  one transaction, completion reuses the returned row (no re-read), and the
  per-row `TEST_RUN_STATUS` broadcast is throttled to ≤1/400ms per run (each
  `ATTACK_RESULT` still delivered). Overhead per attack: 4 DB round-trips + 2 WS
  messages → **2 + ~1**. (`2dff371`, `dabe830`)
- **History no longer loads every log** — each run's score is computed once when
  it finishes and stored on the run (`TestRun.overallScore` / `scoreLabel`); the
  history list reads it back instead of loading thousands of log rows. Falls back
  to on-the-fly scoring for in-progress or not-yet-backfilled runs. (`8425721`)

**Explained findings** (`3a8998b` server, `82d738d` client)

Onyx now **explains and confirms** each result instead of just recording a status
code. A rule-based analysis engine (microseconds each, no extra attack traffic)
turns every result into a real finding — **category, plain-English cause, the
concrete evidence from the response, remediation, and a confidence level** —
confirming reflected XSS, SQL-error / stack-trace disclosure, path-traversal file
reads, secret leaks, auth bypass, and unhandled 5xx crashes. Every row in the
live dashboard and the report is click-to-expand to show the full explanation,
and severity is now computed one way across the list, report, and live stream.

---

## 🎨 Full Light-Mono UI Conversion (Jul 10, 2026)

The entire client was migrated to the **light-mono** design system (composio /
Linear-clean: `#fafafa` surface, white `#e6e6e6` hairline cards, sharp corners,
no shadows, Geist + JetBrains Mono, single blue `#3b82f6` accent, semantic
severity red → orange → amber → green). Shipped page-by-page to `main`.

- **Every page converted**: Landing, Docs, SignIn/SignUp, Settings, **Profile**
  (new), Billing (also redesigned — single visual anchor, balanced current-plan
  strip, trust row), History, Report, and the **Dashboard command center**
  (full rebuild — the murky ghost-skeleton idle state was replaced with a clean
  empty state + 3-step guide; the live console mirrors the Report page).
- **Shared shell**: AppHeader (avatar always visible), GoBackButton (now a
  minimal text link, not the sliding pill), OrgSwitcher, ColdStartBanner,
  DomainVerifyPanel, DashboardCommand.
- **Font unified to Geist** app-wide; zero Inter/Satoshi overrides remain.

Next focus: **backend performance + architecture** (analysis in progress).

---

## 🔒 Security & Reliability Hardening (Jul 2026)

A full backend audit (auth, attack pipeline, billing, orgs, data) closed every
confirmed CRITICAL and HIGH defect in one pass. See
[AGENTS.md](AGENTS.md) for the running work-log.

**Critical**

- **Attack-run hang fixed** — a BullMQ job that exhausted its retries never
  incremented `completedAttacks`, so runs could stick in `ATTACKING` forever and
  permanently consume the user's active-run slot. A shared
  `finalizeIfComplete` / `recordFailedAttempt` path now accounts for terminal
  failures. Aborted/deleted runs are also short-circuited by the worker.
- **Billing `/verify` hardened** — requires a genuinely `active` Razorpay
  subscription (previously accepted `created`/`authenticated`, which handed out
  paid plans before payment) and confirms the subscription belongs to the caller.
- **Webhook forgery/replay protection** — constant-time HMAC comparison, a
  `WebhookEvent` idempotency ledger, and server-side re-verification against
  Razorpay's real subscription state before any plan upgrade.
- **`resolvePlan` defaults to FREE** (never PRO) for unknown plan ids.

**High**

- JWT verification pinned to `HS256`; Google OAuth requires a verified email
  before account-linking (account-takeover fix).
- PDF export gated on the **effective** plan (org-aware + expiry-aware); org-owned
  runs authorized by org membership.
- Expired paid plans (`planExpiresAt < now`) fall back to FREE.
- Last-owner guard made transactional (no zero-owner race); org invites bound to
  the invited email (no longer a shareable bearer link).
- `/attack` now enforces `checkQuota`; SSRF guard fails closed and blocks
  IPv4-mapped IPv6, `::`, decimal/hex IP literals, and CGNAT.

**Schema:** `WebhookEvent` model, `users.razorpaySubId` unique, `TestRun`
`(userId, createdAt)` + `(orgId, createdAt)` indexes.

---

## ✅ What's Been Built (Phase 1 — Complete)

### Core Product (Pre-Session)

- OpenAPI spec ingestion (v3 + Swagger URL)
- Gemini 2.5 Flash AI payload generation (SQLi, XSS, auth bypass, SSRF, etc.)
- BullMQ + Redis job queue for attack execution
- WebSocket real-time telemetry streaming to React frontend
- PostgreSQL persistence via Prisma ORM
- JWT authentication
- WAF bypass (Chrome header spoofing)
- SSRF guard (custom DNS resolver blocking internal network requests)
- IP-based rate limiting on attack endpoints

---

### Billing & Monetization

- **Razorpay subscriptions** integrated (India-based, KYC approved, live mode active)
- **Lazy initialization** pattern for Razorpay SDK (prevents server crash on missing env vars)
- **Three subscription tiers:**

| Plan | Price          | Test Runs/mo | Endpoints/run |
| ---- | -------------- | ------------ | ------------- |
| Free | $0             | 5            | 10            |
| Pro  | $9/mo (₹900)   | 100          | 50            |
| Team | $18/mo (₹1800) | 500          | Unlimited     |

- **Quota middleware** (`checkQuota`) — enforces plan limits before each test run, returns 429 `QUOTA_EXCEEDED` with `{ limit, used, plan, upgradeUrl }`
- **Webhook handler** with raw Buffer HMAC-SHA256 signature verification
- **Webhook events handled:** `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `payment.failed`
- **Prisma schema additions:** `Plan` enum, `plan`, `razorpaySubId`, `planExpiresAt` on User model
- **Billing routes:** `POST /api/billing/subscribe`, `POST /api/billing/cancel`, `POST /api/billing/webhook`
- **`GET /api/user/me`** endpoint returning `{ id, email, plan, planExpiresAt }`
- **In-app Razorpay modal** (no redirect to external page)
- **Smart polling** after payment — polls backend every 2s until plan upgrades in DB
- **PRO/TEAM badge** in navbar and dashboard for paid users
- **USD pricing display** with INR note (₹900/mo) for transparency

---

### PDF Report Export

- **`generateTestRunPDF(testRunId, userId)`** service using PDFKit
- **Ownership verification** — 403 if userId doesn't match test run
- **Plan gate** — FREE users get 403 `PLAN_REQUIRED` → redirects to `/billing`
- **Report sections:**
    - Dark header with run ID, timestamp, spec URL
    - Executive summary with 6 metrics + risk label (CLEAN / MEDIUM / HIGH / CRITICAL)
    - Attack results table sorted VULNERABLE → SUSPICIOUS → PASS with alternating row shading
    - Auto page breaks for large result sets
    - Dark footer with page numbers
- **`GET /api/test-runs/:id/export/pdf`** route with correct Content-Type + Content-Disposition headers
- **Frontend export button** — visible only on COMPLETED runs, triggers browser download, shows spinner, redirects FREE users to billing

---

### Landing Page

- Hero: "Break Your API. Before They Do." with cyan gradient on tagline
- Updated subtitle focused on pain, not features
- Social proof bar below hero
- Stats section (500+ scans, 10+ attack types, real-time results)
- Full pricing section with Free/Pro/Team cards
- "View Live Demo" CTA button
- Footer with Pricing link
- **Visual enhancements:**
    - `min-h-screen` hero, `font-black text-6xl md:text-8xl` headline
    - Cyan gradient on "Before They Do."
    - Radial glow behind terminal (removed mountain background image)
    - Terminal: `border-cyan-500/20 shadow-[0_0_40px_rgba(6,182,212,0.1)]`
    - Pro pricing card: `border-2 border-cyan-500` + `shadow-[0_0_60px_rgba(6,182,212,0.15)]`
    - Stats cards: `border-t-2 border-cyan-500` + cyan number gradient
    - Frosted glass navbar: `backdrop-blur-md bg-black/80`
    - Section headings: `text-4xl md:text-5xl font-bold`

---

### DevOps & CI/CD

- **`.github/workflows/ci.yml`** — triggers on push/PR to main, runs `prisma generate` + `tsc --noEmit` on both client and server + Vitest
- **`.github/workflows/deploy-check.yml`** — deploy gate, runs tsc on push to main
- **`.github/ISSUE_TEMPLATE/bug_report.md`** and `feature_request.md`
- **`.github/PULL_REQUEST_TEMPLATE.md`**
- **README.md** rewritten with full architecture, API reference, setup guide, tech stack table
- Deployed on **Render** (backend) + **Vercel** (frontend)
- All secrets managed via environment variables (never committed)

---

## 🔜 What's Next (Phase 2–5)

### Phase 2 — Enterprise Readiness (Next Up)

- [ ] **CVSS Severity Scoring** — Critical/High/Medium/Low per finding based on attack type + response + data leaked. Overall API security score (0–100) per test run
- [ ] **Organization / Workspace model** — `Org → Users → TestRun` multi-tenant schema
- [ ] **RBAC** — Owner / Admin / Viewer roles per org
- [ ] **Audit logs** — immutable log of every sensitive action (who ran what, when, from where)
- [ ] **Target authorization verification** — require `onyx-verify.txt` file or DNS TXT record before firing attacks (legal protection + enterprise trust)

### Phase 3 — Growth Engine

- [ ] **Public REST API + API keys** — `POST /v1/test-runs` with Bearer token for CI/CD integration
- [ ] **CLI tool** — `npx onyx-scan https://api.example.com/openapi.json`
- [ ] **GitHub Actions integration** — scan on every PR
- [ ] **Scheduled/recurring scans** — cron-based re-scanning with regression detection
- [ ] **Slack/email alerts** — notify when critical vulns found

### Phase 4 — Retention & Depth

- [ ] **Onboarding flow** — guided first scan using PetStore demo API, tooltips, empty states
- [ ] **Diff / regression view** — compare two test runs side by side ("3 new vulnerabilities since last scan")
- [ ] **Custom payload rules** — Pro users define their own payload templates in YAML
- [ ] **SARIF export** — GitHub Security tab compatible format
- [ ] **GitHub Issues integration** — auto-create issues from critical findings

### Phase 5 — SOC 2 Readiness

- [ ] All PII encrypted at rest
- [ ] Secret management via vault (not plain `.env` in prod)
- [ ] Immutable audit trail
- [ ] SOC 2 Type II readiness audit

---

## 🏗️ Current Tech Stack

| Layer      | Technology                            |
| ---------- | ------------------------------------- |
| Frontend   | React, TypeScript, Tailwind CSS, Vite |
| Backend    | Node.js, Express, TypeScript          |
| AI         | Gemini 2.5 Flash                      |
| Queue      | BullMQ + Redis                        |
| Database   | PostgreSQL (Neon) via Prisma ORM      |
| Auth       | JWT                                   |
| Payments   | Razorpay (Live mode)                  |
| PDF        | PDFKit                                |
| Realtime   | WebSockets (native ws)                |
| Deployment | Vercel (frontend) + Render (backend)  |
| CI/CD      | GitHub Actions                        |

---

## 📊 Business Status

| Metric                | Status          |
| --------------------- | --------------- |
| Razorpay KYC          | ✅ Approved     |
| Live payments         | ✅ Active       |
| Test mode             | ✅ Fully tested |
| Free tier             | ✅ Live         |
| Pro tier ($9/mo)      | ✅ Live         |
| Team tier ($18/mo)    | ✅ Live         |
| PDF export (Pro gate) | ✅ Working      |
| Quota enforcement     | ✅ Working      |

---

_Last updated: Jul 2026 | Built by Raghul A.R_
