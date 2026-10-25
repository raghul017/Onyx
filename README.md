# Onyx

**AI-native API security testing.** Point Onyx at an OpenAPI/Swagger spec and it
parses every endpoint, generates schema-aware attack payloads, fires them safely
against a domain you've proven you own, and streams severity-scored findings back
in real time — each mapped to the OWASP API Security Top 10 (2023), with evidence
and a concrete fix.

> **Authorized testing only.** Onyx requires domain-ownership verification before
> it will send a single payload. Scan APIs you own or are explicitly authorized to
> test.

---

## What it does

1. **Parse** — reads a public OpenAPI v3 / Swagger 2.0 spec URL and extracts every
   endpoint, parameter (path/query/header/cookie) and request-body schema.
2. **Authenticate** *(optional)* — attaches a credential so the scan reaches what's
   behind the login.
3. **Baseline** *(paid plans)* — captures one benign control response per endpoint.
4. **Attack** — queues schema-aware payloads and fires them with bounded
   concurrency, an SSRF guard, and a 10-second per-request timeout.
5. **Analyze** — classifies each response into an explained finding (category,
   cause, evidence, remediation, confidence), diffing against the baseline to cut
   false positives.
6. **Report** — live WebSocket stream, a scored report, OWASP coverage, PDF export,
   and an optional public read-only share link.

---

## Features

### Detection

| Capability | What it does |
|---|---|
| **Injection & input handling** | SQL injection, XSS, path traversal, type confusion, boundary/oversized payloads, rate-limit probing |
| **Evidence-based verdicts** | Each endpoint gets a benign **baseline**; attack responses are diffed against it (status, body length, latency, reflection) so a finding is attributable rather than guessed |
| **Blind / time-based injection** | Confirmed by a measured latency delta vs. baseline — **or** by a delay payload that exceeds the request timeout while the baseline answered fast |
| **Authenticated scanning** | Scans behind the login using a bearer token, API key, custom header, cookie, **OAuth2 client-credentials**, or a full **login-request** flow, with automatic re-auth on a mid-scan 401 |
| **Missing-auth probes** | Deliberately strips credentials to prove access control holds |
| **BOLA (API1)** | Acquires an object id as user A, replays the request as user B, and compares the responses to prove cross-user data access |
| **BFLA (API5)** | Calls privileged/administrative endpoints as a lower-privileged identity to prove function-level authorization is missing |
| **Mass assignment (API3)** | Adds privileged fields (`role`, `isAdmin`, `balance`, `ownerId`, …) to a valid write body and confirms the server accepted and reflected them |
| **Excessive data exposure (API3)** | Inspects responses already collected for password hashes, tokens, SSN/card numbers, internal flags, and bulk PII |

Detection is deliberately **conservative** — a finding is only raised when the
evidence supports it. A request your API correctly rejected (a 4xx with a generic
message, or 401/403 on a protected route) is a healthy INFO result: it doesn't
lower the score and isn't reported as a finding. An error response is only
flagged when it leaks internals (stack trace, database error, server file path,
exception class). Where an AI model is consulted (BOLA interpretation), it can
only *confirm or veto* a verdict the deterministic rules already reached; it can
never raise a finding on its own, and the pipeline works with the model
unavailable.

### OWASP API Security Top 10 (2023)

Every finding is labeled with its category, and the report + PDF include a coverage
matrix.

| Actively detected | Mapped — coverage expanding |
|---|---|
| **API1** Broken Object Level Authorization | API6 Unrestricted Access to Sensitive Business Flows |
| **API2** Broken Authentication | API7 Server Side Request Forgery |
| **API3** Broken Object Property Level Authorization | API9 Improper Inventory Management |
| **API4** Unrestricted Resource Consumption | API10 Unsafe Consumption of APIs |
| **API5** Broken Function Level Authorization | |
| **API8** Security Misconfiguration | |

### Workflow

- **Framework-specific fixes** — each finding's remediation can be shown as a
  concrete snippet for **Express, FastAPI, Spring, or Django**. The library is
  hand-curated (no generated security advice); where no vetted snippet exists for a
  finding type, the generic guidance is shown instead.
- **Verify a fix (re-scan)** — re-run the exact check behind a single finding. If it
  no longer reproduces it's marked **Resolved**; if it does, it's recorded as still
  present. *Cross-identity findings (BOLA/BFLA) can't be re-scanned yet* — they need
  a live second identity — and say so instead of guessing.
- **Shareable reports** — mint a tokenized public link that renders the report
  read-only without a login, and revoke it instantly. The public payload contains
  only the report (scores, findings, coverage) — never credentials or the sharer's
  identity.
- **PDF export** *(paid plans)* — full report with the OWASP coverage section.
- **Multi-tenancy** — organizations with roles (owner/admin/viewer) and invites.

### CI/CD

- **CLI** — `onyx scan --spec <url> --fail-on high --format sarif`. Table, JSON, or
  SARIF 2.1.0 output; exit code gates the build. See **[cli/README.md](cli/README.md)**.
- **GitHub Action** — runs the scan on pull requests, uploads SARIF to the Security
  tab, comments findings on the PR, and fails the check on your threshold. See
  **[action/README.md](action/README.md)**.

---

## Safety

Onyx is an offensive tool, so the guardrails are part of the product:

- **Domain-ownership verification** — a probe file (`/.well-known/onyx-verify.txt`)
  or a DNS TXT record is required before any target can be scanned.
- **SSRF guard** — every target URL is DNS-resolved and checked; loopback, private,
  link-local, CGNAT, cloud-metadata and IPv4-mapped-IPv6 addresses are blocked, and
  re-vetted on a short TTL to defeat DNS rebinding.
- **Bounded blast radius** — 10s request timeout, bounded worker concurrency and an
  evenly-paced rate limiter, IP rate limits on auth/scan endpoints, per-plan quotas.
- **Secrets** — auth-recipe credentials are encrypted at rest (AES-256-GCM); API
  tokens are stored only as SHA-256 hashes; response evidence is redacted before it
  is stored or streamed; credentials are kept out of logs.
- **Compliance** — Onyx is **not** SOC 2 or ISO certified. Any such certification is
  roadmap, not fact.

---

## Tech stack

**Server** — Node + TypeScript, Express, Prisma 7 / PostgreSQL, BullMQ on Redis,
`ws` WebSockets, Zod, Google Gemini 3.5 Flash-Lite (payload generation + BOLA judge), PDFKit, Pino, Sentry.

**Client** — React 18 + TypeScript, Vite, Tailwind (light-mono design system),
TanStack Query, Zustand, React Router, Framer Motion, three.js.

**CLI** — standalone TypeScript package, Node ≥ 20, zero runtime dependencies.

---

## Getting started

### Prerequisites

- Node.js ≥ 20
- Docker (for local PostgreSQL + Redis), or your own instances
- A Google Gemini API key (optional — Onyx falls back to a static payload set)

### 1. Install

```bash
git clone https://github.com/raghul017/Onyx.git
cd Onyx
(cd server && npm install)
(cd client && npm install)
```

### 2. Start infrastructure

```bash
docker compose up -d      # PostgreSQL + Redis
```

### 3. Configure the server

Create `server/.env`:

```bash
# Required
DATABASE_URL="postgresql://onyx:onyx@localhost:5432/onyx"
JWT_SECRET="a-long-random-string"
# 32-byte key (64 hex chars) used to encrypt auth-recipe secrets at rest.
# Generate: openssl rand -hex 32
CREDENTIAL_ENC_KEY="<64-hex-chars>"

# Redis (either REDIS_URL, or host/port)
REDIS_URL="redis://localhost:6379"

# Optional
GEMINI_API_KEY=""                  # omit to use the static fallback payloads
GEMINI_MODEL=""                    # defaults to gemini-3.5-flash-lite
CLIENT_URL="http://localhost:8080"
SERVER_URL="http://localhost:3000"
SHARE_BASE_URL=""                  # base for public share links (defaults to the request origin)
SKIP_DOMAIN_VERIFY="false"         # dev only — NEVER enable against real targets
SENTRY_DSN=""
LOG_LEVEL="info"

# OAuth sign-in (optional)
GOOGLE_CLIENT_ID=""; GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""; GITHUB_CLIENT_SECRET=""

# Billing (optional — billing routes error without these)
RAZORPAY_KEY_ID=""; RAZORPAY_KEY_SECRET=""; RAZORPAY_WEBHOOK_SECRET=""
RAZORPAY_PRO_PLAN_ID=""; RAZORPAY_TEAM_PLAN_ID=""
```

### 4. Apply migrations

Onyx uses **Prisma Migrate** as the single source of truth. Never use `db push`.

```bash
cd server
npx prisma migrate deploy    # apply pending migrations
npx prisma generate
npx prisma migrate status    # should say "Database schema is up to date!"
```

`npm start` runs `prisma migrate deploy` before booting, so deploys self-apply.
See **[docs/MIGRATIONS.md](docs/MIGRATIONS.md)**.

### 5. Run

```bash
cd server && npm run dev     # API + worker + WebSocket on :3000
cd client && npm run dev     # UI on :8080
```

The BullMQ worker runs **in-process** with the API server — there is no separate
worker process to start.

---

## API reference

All routes are under `/api`. Everything requires a JWT (`Authorization: Bearer …`)
or an Onyx API token, except where noted. An `x-org-id` header scopes a request to
an organization.

**Auth** — `POST /auth/signup` · `POST /auth/signin` · `GET /auth/:provider` ·
`GET /auth/:provider/callback` *(public)*

**Test runs** — `GET /test-runs` · `POST /test-runs` · `GET /test-runs/:id` ·
`DELETE /test-runs/:id` · `GET /test-runs/:id/logs` · `POST /test-runs/:id/abort` ·
`POST /attack` · `GET /test-runs/:id/export/pdf` *(paid)*

**Findings** — `POST /test-runs/:id/logs/:logId/rescan` (verify a fix)

**Sharing** — `POST /test-runs/:id/share` · `GET /test-runs/:id/share` ·
`POST /test-runs/:id/share/revoke` · `GET /shared/:token` *(**public**, no auth)*

**Domain verification** — `POST /verify-target` · `POST /verify-target/check` ·
`GET /verify-target` · `DELETE /verify-target/:id`

**Auth recipes** — `POST|GET /auth-recipes` · `GET|PATCH|DELETE /auth-recipes/:id`

**API tokens** — `POST|GET /api-tokens` · `POST /api-tokens/:id/revoke`

**Organizations** — `GET|POST /orgs` · `GET|PATCH|DELETE /orgs/:orgId` ·
`GET /orgs/:orgId/members` · `PATCH|DELETE /orgs/:orgId/members/:userId` ·
`POST|GET /orgs/:orgId/invites` · `DELETE /orgs/:orgId/invites/:inviteId` ·
`POST /invites/accept`

**Billing** — `POST /billing/subscribe` · `POST /billing/verify` ·
`POST /billing/cancel` · `POST /billing/webhook`

**Misc** — `GET /user/me` · `PATCH /user/me` · `GET /health` *(public; includes
the deployed `commit`)* · `GET /openapi.json` *(public)*

**WebSocket** — get a 60-second ticket from `POST /ws-ticket`, connect to
`/ws?ticket=<ticket>`, then `SUBSCRIBE` to a `testRunId` to receive
`ATTACK_RESULT` and `TEST_RUN_STATUS` messages live. Only the run's owner or a
member of its organization can subscribe.

---

## Plans

Priced in USD, billed in INR.

| | **Free** — $0 | **Pro** — $9/mo | **Team** — $18/mo |
|---|---|---|---|
| Test runs / month | 5 | 100 | 500 |
| Endpoints per run | 10 | 50 | 200 |
| Check types | All | All | All |
| Authenticated scanning | ✓ | ✓ | ✓ |
| OWASP mapping + live console | ✓ | ✓ | ✓ |
| Workspaces, API tokens, CLI & GitHub Action | ✓ | ✓ | ✓ |
| Baseline capture & diffing | — | ✓ | ✓ |
| PDF report export | — | ✓ | ✓ |

Quotas live in `server/src/lib/plan-limits.ts` and are enforced server-side: run
quota per calendar month, and the endpoints-per-run cap applied right after the
spec is parsed (a larger spec is truncated). PDF export and baseline capture are
the paid-only gates. Inside an organization, the better of the org's plan and its
owners' active plans applies.

---

## Repository layout

```
server/    Express API + BullMQ worker + Prisma schema/migrations
client/    React SPA (dashboard, report, marketing site)
cli/       `onyx scan` — standalone CLI (table/JSON/SARIF)
action.yml + action/   GitHub Action (composite) + its README
docs/      Internal docs: MIGRATIONS, UPDATES (dev log), plans
```

## Docs

- **[docs/MIGRATIONS.md](docs/MIGRATIONS.md)** — migration policy and history
- **[docs/UPDATES.md](docs/UPDATES.md)** — internal per-ticket dev log
- **[cli/README.md](cli/README.md)** · **[action/README.md](action/README.md)**
- **[AGENTS.md](AGENTS.md)** — architecture context and repo conventions

## License

See [LICENSE](LICENSE).
