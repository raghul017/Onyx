# Onyx — Project Report & Improvement Brief

> **Purpose of this document.** A self-contained briefing on the Onyx codebase so
> a fresh AI/engineering review can propose improvements, changes, or new features
> without re-reading the whole repo first. It states what exists, how it works,
> where the code lives, and — most importantly — the **known gaps and candidate
> improvements** (last section). Facts here reflect the repo as of **2026-07-13**.
>
> Companion docs: [README.md](README.md) (features), [WORKFLOW.md](WORKFLOW.md)
> (deep architecture), [AGENTS.md](AGENTS.md) (work log + conventions),
> [changelog.md](changelog.md), [PROGRESS.md](PROGRESS.md).

---

## 1. TL;DR

Onyx is an **AI-native API penetration-testing platform**. You give it a public
OpenAPI/Swagger spec URL; it parses the schema, uses **Gemini 2.5 Flash** to
generate schema-aware attack payloads per endpoint, fires them through a queued
worker, **streams results live** over WebSockets, and **analyzes each result into
an explained finding** (category, cause, evidence, remediation, confidence). It
has real multi-tenancy (orgs + RBAC), plan-gated quotas, Razorpay billing, PDF
export, SSRF protection, and domain-ownership verification.

- **Live:** client → Vercel · server → Render (free tier) · DB → Neon Postgres · queue → Redis.
- **Repos of note:** `client/` (React SPA) and `server/` (Express API + worker) in one monorepo.

---

## 2. Repository map (where things live)

```
Onyx/
├─ client/                      # React 18 + Vite SPA (light-mono design system)
│  └─ src/
│     ├─ pages/                 # Landing, Docs, SignIn/SignUp, Dashboard, History,
│     │                         #   Report, Billing, Settings, Profile, InviteAccept…
│     ├─ components/            # AppHeader, DashboardCommand (live console),
│     │                         #   FindingDetailPanel, DomainVerifyPanel, ColdStartBanner,
│     │                         #   Navbar, Hero, GoBackButton, OrgSwitcher…
│     ├─ store/                 # Zustand — useAttackStore (WS live results), useAuthStore
│     ├─ services/api.ts        # REST client + shared TS types (AttackResult, FindingDetail…)
│     └─ index.css              # light-mono design tokens (.onyx-mono, .mono-btn…)
├─ server/
│  └─ src/
│     ├─ index.ts               # Express app + HTTP/WS server bootstrap + graceful shutdown
│     ├─ routes/                # index.ts (test-runs, user, verify, pdf), auth.ts, billing, org
│     ├─ controllers/           # test-run, auth, org, domain-verify
│     ├─ services/
│     │   ├─ openapi-parser.ts  # parse Swagger 2.0 / OpenAPI 3.x → endpoints
│     │   ├─ ai-payload.ts      # Gemini payload generation + 35 static fallbacks
│     │   ├─ finding-analysis.ts# ← rule engine: result → explained finding (what/why/fix)
│     │   ├─ run-score.ts       # ← denormalized run score (compute + persist at completion)
│     │   ├─ billing.service.ts, razorpay.service.ts, org.service.ts, pdf.service.ts,
│     │   └─ domain-verify.service.ts
│     ├─ queues/                # chaos-queue.ts (BullMQ config), producer.ts, worker.ts
│     ├─ websockets/ws-manager.ts   # per-run subscription rooms + broadcast
│     ├─ middleware/            # auth.ts (JWT), quota.middleware.ts, org.middleware.ts
│     ├─ lib/                   # prisma.ts (pg pool), ssrf-guard.ts
│     └─ utils/severity.ts      # CVSS-inspired scoring (delegates to finding-analysis)
│  └─ prisma/schema.prisma      # data model
└─ .github/workflows/           # ci.yml, deploy-check.yml, keep-warm.yml (Render anti-cold-start)
```

---

## 3. Architecture & data flow

```
Paste spec URL → verify domain ownership → POST /api/test-runs
  → 201 returned immediately; processing is async:
      1. parse OpenAPI (openapi-parser.ts)
      2. status → GENERATING; save endpoints
      3. status → ATTACKING as soon as the FIRST endpoint's payloads are ready
      4. per endpoint (cap 20): Gemini → ~20 payloads (or 35 static fallbacks)
      5. enqueue each payload as a BullMQ job (producer.ts)
  → worker (worker.ts): for each job
      - re-check run status (drop if aborted)
      - SSRF-guard the target (cached per host)
      - fire the HTTP payload (10s timeout)
      - persist log + increment counter (ONE transaction)
      - analyze → finding; WebSocket broadcast ATTACK_RESULT
      - throttled TEST_RUN_STATUS progress
  → when completedAttacks == totalAttacks && enqueuedAt set:
      atomic status→COMPLETED, persist overallScore/scoreLabel, broadcast COMPLETED
  → History (list, reads stored score) / Report (full log + finding detail) / PDF export
```

**Notable design decisions**
- HTTP returns fast; the client subscribes over WS and watches results stream.
- The run flips to `ATTACKING` early so the first endpoint fires while later ones
  still generate (no dead wait for every Gemini call).
- Completion is **race-safe**: an `enqueuedAt` marker prevents an early finisher
  from completing a run mid-enqueue, and the COMPLETED transition is a single
  atomic status-filtered `updateMany` so concurrent finishers can't double-complete.

---

## 4. Tech stack

| Area | Tech |
|---|---|
| Client | React 18, Vite, TypeScript, Tailwind (light-mono), Zustand, React Router v6, TanStack Query, Recharts, framer-motion |
| Server | Node 20, Express 4, TypeScript, `ws`, BullMQ 5, Zod, Helmet, Morgan, express-rate-limit |
| AI | Google GenAI SDK — Gemini 2.5 Flash (JSON mode, senior-pentester system prompt) |
| DB | PostgreSQL (Neon), Prisma 7 + `@prisma/adapter-pg` (pg Pool min 2 / max 20) |
| Queue | Redis + BullMQ (worker concurrency 12, limiter ~30/s, 3 retries exp backoff, 10s job timeout) |
| Billing | Razorpay subscriptions + webhook verification (idempotency ledger) |
| Auth | JWT HS256 (7-day), bcrypt cost 12, Google + GitHub OAuth (server-side redirect) |
| Deploy | Vercel (client), Render (server, free tier), Neon (DB), Redis |

---

## 5. Feature inventory

- **OpenAPI/Swagger parsing** (2.0 + 3.x): methods, paths, request-body schemas, params.
- **AI payload synthesis**: ~20 payloads/endpoint across 8 types — `SQL_INJECTION`,
  `XSS`, `BOUNDARY`, `MISSING_AUTH`, `PATH_TRAVERSAL`, `OVERSIZED_PAYLOAD`,
  `TYPE_CONFUSION`, `RATE_LIMIT`. Static 35-payload fallback if Gemini fails.
- **Queued execution + live streaming**: BullMQ worker fires payloads, records
  status/latency/response snippet (cap 500 chars); results stream over WS. Runs
  can be **aborted** (drains pending jobs; in-flight jobs self-cancel).
- **Explained findings** (`finding-analysis.ts`): confirms & explains reflected XSS,
  SQL/stack-trace disclosure, path-traversal file reads, secret leaks, auth bypass,
  5xx crashes; each finding = category + cause + evidence + remediation + confidence.
  Expandable detail in Dashboard (live) + Report.
- **CVSS-inspired scoring**: per-finding severity → deductions → 0–100 score + label;
  denormalized onto the run at completion (`overallScore` / `scoreLabel`).
- **Security**: DNS-resolving SSRF guard (private/loopback/link-local/CGNAT/metadata
  + IPv4-mapped IPv6, per-host cache); domain-ownership verification (file or DNS TXT).
- **Multi-tenancy**: organizations, RBAC (OWNER/ADMIN/VIEWER), token-based invites.
- **Auth**: JWT + bcrypt; Google/GitHub OAuth; WS handshake auth.
- **Billing**: Razorpay subscriptions, webhook-verified upgrades, plan-gated quotas.
- **Reporting**: server-side PDF export (Pro/Team).
- **Abuse limits**: 5 runs/hr/IP; per-user cap of 2 concurrent active runs; Helmet; Zod.

---

## 6. Data model (Prisma)

`User` (email, passwordHash?, googleId?, githubId?, plan, razorpaySubId?, planExpiresAt?) ·
`Organization` · `OrgMember` (role) · `OrgInvite` (token, expiresAt) ·
`TestRun` (status, totalEndpoints/Attacks, completedAttacks, `enqueuedAt`,
**`overallScore?` / `scoreLabel?`**, userId?/orgId?) ·
`TargetEndpoint` (method, path, requestBodySchema) ·
`AttackLog` (payload, statusCode?, latencyMs?, responseSnippet?, attackType, error?) ·
`VerifiedTarget` (domain, token, verifiedAt?) · `WebhookEvent` (idempotency).

---

## 7. API surface

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | public |
| GET | `/api/openapi.json` | public — Onyx can scan itself |
| POST | `/api/auth/signup` · `/signin` · OAuth start/callback | JWT issue |
| GET/PATCH | `/api/user/me` | profile + display name |
| GET | `/api/test-runs` | list (reads denormalized score) |
| POST | `/api/test-runs` · `/api/attack` | create run (rate-limited, quota-gated) |
| GET | `/api/test-runs/:id` | summary + full logs w/ findings |
| GET | `/api/test-runs/:id/logs` | paginated logs |
| POST | `/api/test-runs/:id/abort` | drain + FAIL |
| DELETE | `/api/test-runs/:id` | delete + drain |
| GET | `/api/test-runs/:id/export/pdf` | Pro/Team, effective-plan gated |
| POST/GET/DELETE | `/api/verify-target*` | domain ownership |
| — | `/api/billing/*`, org routes | Razorpay + org CRUD/invites |

Plan limits: **FREE** 5 runs/mo, 10 endpoints/run · **PRO** 100 / 50 · **TEAM** 500 / unlimited · **ENTERPRISE** unlimited. Effective plan = org plan for org-owned runs.

---

## 8. Deployment & ops

- Client on Vercel; server on **Render free tier** (spins down when idle → cold
  starts, mitigated by `.github/workflows/keep-warm.yml`, not eliminated).
- DB is Neon Postgres via the **pooler** endpoint. Schema changes ship via
  `prisma db push` (no migration history) — documented in the PR template.
- CI: `ci.yml`, `deploy-check.yml`, `keep-warm.yml`.

---

## 9. Known limitations & technical debt (be honest here)

**Detection depth (biggest gap)**
- Detection is **single-request**: no baseline/control request per endpoint, so
  blind/boolean/time-based SQLi, stored XSS, and IDOR aren't *confirmed* — only
  surfaced from status codes + response signatures. False positives/negatives likely.
- No **auth-context** testing (authed vs. unauthed baseline), no stateful/multi-step
  sequences, no CSRF, and the `RATE_LIMIT` "attack" is just a marker (no real burst).
- Attacks don't inject the user's own auth token into requests, so authenticated
  endpoints mostly return 401/403 (recorded as "access control enforced").

**Coverage / scale**
- Endpoints are **capped at 20 per run**; large APIs are under-tested.
- Gemini is a hard dependency and a per-run cost; payloads aren't cached per spec.

**Reliability / DX / ops**
- **Essentially no test coverage** (only a placeholder `client/src/test/example.test.ts`).
- **No Prisma migrations** (db push only) → schema-drift risk, no rollback.
- Observability is `console.log` + morgan — no structured logs, metrics, or error tracking.
- `drainTestRunJobs` scans the **whole** BullMQ queue on each abort/delete (O(all jobs)).
- Redis is queue-only (no read-cache for hot endpoints like `getCurrentUser`).

**Security of Onyx itself**
- JWT is passed in the **WS handshake query string** (logged by morgan); no refresh/revocation.
- OAuth `state` isn't bound to the browser session (replay risk) — deferred.
- Org **billing is effectively unwired**: webhooks only update `User`, never `Organization`.
- Response snippets (up to 500 chars) are stored raw — may capture **sensitive data**
  from a target's responses (PII/secrets) with no redaction or retention policy.

---

## 10. Candidate improvements — research prompts (prioritized)

Use these as starting points for a review session. Each is phrased so an AI can
research options, weigh trade-offs, and propose a concrete plan.

**A. Detection depth (highest product value)**
1. Design a **baseline-diffing** layer: send a benign control request per endpoint,
   diff it against payload responses to confirm reflection, error-based, and
   boolean/time-based issues, and cut false positives. Trade-off: doubles request
   volume — how to keep it "fast"? (batch controls, reuse across payloads, sample.)
2. Add **auth-context scanning**: let the user attach a token/cookie so authed
   endpoints are actually exercised; then test authz (IDOR/BOLA) by swapping IDs.
3. Add **time-based blind** detection (latency anomaly vs. baseline) and stored-XSS
   follow-up reads.

**B. Coverage & scale**
4. Raise/replace the 20-endpoint cap intelligently (prioritize by risk, sample,
   or paginate scans); handle large specs without blowing Gemini cost.
5. Cache/generate payloads per spec-hash to cut repeat Gemini calls and cost.
6. Model stateful sequences (create → read → delete) instead of independent hits.

**C. Reliability, testing, ops**
7. Introduce **Prisma migrations** (replace db push) with a deploy step.
8. Stand up a **real test suite** (unit for finding-analysis/severity/ssrf-guard;
   integration for the pipeline; a couple of e2e happy paths).
9. Add **observability**: structured logging, request tracing, error tracking
   (Sentry), and basic metrics (queue depth, per-stage latency).
10. Make `drainTestRunJobs` targeted (track per-run job ids in Redis).
11. Eliminate cold starts (paid tier / different host) vs. the keep-warm cron.

**D. Security hardening of Onyx**
12. Move the WS JWT out of the query string (subprotocol header or short-lived ticket);
    add token refresh + revocation.
13. Bind OAuth `state` to the session (PKCE/cookie nonce).
14. Redact/limit stored `responseSnippet` (secrets/PII), add data-retention + encryption.
15. Wire org billing (webhooks → `Organization` by `razorpaySubId`); per-user rate limits.

**E. Product / go-to-market**
16. **Scheduled scans**, **run-to-run diff/regression** view, **SARIF export** + a
    **GitHub Action** / CI mode, a **public REST API + API keys**, and richer reports
    (CWE/OWASP references, severity trends).
17. Audit logs (immutable record of sensitive actions).

---

## 11. Running locally / verifying

- Server: `cd server && npm run dev` (needs `.env`: `DATABASE_URL`, `REDIS_*`,
  `JWT_SECRET`, `GEMINI_API_KEY`, Razorpay keys, `CLIENT_URL`). `npm run typecheck`
  / `npm run build` to verify. Schema changes: `npm run db:push` then `db:generate`.
- Client: `cd client && npm run dev` (port 8080). `npm run build` to verify.
- Redis + Postgres locally via `docker-compose up`.
- **Verify behavior, not just types**: the attack pipeline needs Redis + Postgres +
  a reachable target; the finding-analysis and SSRF logic can be unit-tested in
  isolation (see the ad-hoc checks used during development).
