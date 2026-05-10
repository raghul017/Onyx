<div align="center">
  <h1>Onyx</h1>
  <p><strong>AI-Powered API Security Testing Platform</strong></p>
  <p>Feed it an OpenAPI spec. Watch Gemini synthesize attack payloads. Stream results live.</p>

  [![CI](https://github.com/raghul017/Onyx/actions/workflows/ci.yml/badge.svg)](https://github.com/raghul017/Onyx/actions/workflows/ci.yml)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
  [![Node](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
</div>

---

## What is Onyx?

Onyx is an AI-native API penetration testing platform that ingests an OpenAPI/Swagger specification URL and automatically generates schema-aware attack payloads using **Google Gemini 2.5 Flash**. It is built for security engineers and developers who want automated, context-sensitive coverage across OWASP Top 10 categories without writing test cases by hand.

Unlike generic fuzzers, Onyx reads your actual API schema — request bodies, path parameters, query strings — and asks an LLM to reason about what would break each endpoint. Attacks run asynchronously through a **BullMQ/Redis** worker queue and results stream back to the browser in real time over **WebSockets**. A **plan-gated PDF export** lets teams share audit-ready reports from the dashboard.

---

## Features

- **AI payload synthesis** — Gemini generates targeted payloads per endpoint: SQLi, NoSQLi, XSS, SSRF, boundary overflows, auth bypass, and more
- **Real-time attack telemetry** — WebSocket streaming pushes status codes, latency, and response snippets to the dashboard as each attack fires
- **BullMQ job queue** — decoupled worker architecture prevents thread exhaustion and controls concurrency against the target API
- **WAF bypass headers** — outbound requests spoof realistic browser headers to avoid WAF false-negatives during testing
- **SSRF guard** — DNS-resolved IP blocking prevents attacks from routing back to private/internal infrastructure
- **Plan-gated quotas** — middleware enforces Free / Pro / Team run limits per user at the route level
- **PDF report export** — Pro and Team users can download a full attack log as a PDF (generated server-side via pdfkit)
- **Razorpay subscriptions** — built-in billing with webhook-verified plan upgrades, no manual provisioning
- **Graceful AI fallback** — if Gemini rate-limits or fails, static heuristics generate payloads so scans complete
- **JWT auth** — signup/signin with bcrypt password hashing; all test-run routes are authenticated

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, Zustand, React Router v6, TanStack Query, Radix UI, Recharts |
| **Backend** | Node.js 20, Express 4, TypeScript, WebSockets (`ws`), BullMQ, `express-rate-limit`, Helmet, Morgan, Zod |
| **AI** | Google GenAI SDK — Gemini 2.5 Flash (`@google/genai`) |
| **Database** | PostgreSQL (Neon serverless), Prisma ORM 7, `@prisma/adapter-pg` |
| **Queue / Cache** | Redis, BullMQ 5, ioredis |
| **Billing** | Razorpay subscriptions + webhook verification |
| **PDF generation** | pdfkit (server-side) |
| **Auth** | JSON Web Tokens (`jsonwebtoken`), bcrypt |
| **Spec parsing** | `@scalar/swagger-parser`, `swagger-parser` |
| **Testing** | Vitest, `@testing-library/react` |
| **Infra / Deploy** | Docker Compose (local), Render (server), Vercel (client) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for local Redis + PostgreSQL via `docker-compose`)
- Google AI Studio API key ([aistudio.google.com](https://aistudio.google.com))
- Razorpay account (for billing; optional for local dev)

### 1. Clone and install

```bash
git clone https://github.com/raghul017/Onyx.git
cd Onyx
```

```bash
# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Start infrastructure

```bash
# From the project root — boots PostgreSQL and Redis via Docker
docker compose up -d
```

### 3. Configure environment variables

**Server** — copy `server/.env.server.example` to `server/.env`:

```env
PORT=3000
CLIENT_URL=http://localhost:8080

DATABASE_URL=                        # PostgreSQL connection string
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=                      # leave blank for local Docker
REDIS_TLS=                           # set to 'true' for Upstash/managed Redis

JWT_SECRET=                          # generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
GEMINI_API_KEY=                      # from Google AI Studio

# Razorpay (optional for local dev — billing flows will error without these)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_PRO_PLAN_ID=
RAZORPAY_TEAM_PLAN_ID=
```

**Client** — copy `client/.env.client.example` to `client/.env`:

```env
VITE_API_URL=                        # leave blank to use Vite proxy (recommended locally)
VITE_WS_URL=                         # leave blank to use Vite proxy (recommended locally)
VITE_RAZORPAY_PRO_PLAN_ID=
VITE_RAZORPAY_TEAM_PLAN_ID=
```

> For local development `VITE_API_URL` and `VITE_WS_URL` can be left empty — Vite proxies `/api` and `/ws` to `localhost:3001` automatically.

### 4. Set up the database

```bash
cd server
npx prisma db push       # creates tables from schema.prisma
npx prisma generate      # generates the Prisma client
```

### 5. Run the development servers

```bash
# Terminal 1 — backend (hot-reloads via tsx watch)
cd server && npm run dev

# Terminal 2 — frontend (Vite dev server)
cd client && npm run dev
```

The client is served at `http://localhost:8080` by default.

---

## Architecture

```
User submits OpenAPI URL
        │
        ▼
POST /api/attack  (authenticateToken → attackLimiter → checkQuota)
        │
        ▼
Spec fetch + parse  (@scalar/swagger-parser)
        │
        ▼
Gemini AI payload generation  (per endpoint, per attack type)
        │
        ▼
BullMQ job queue  (Redis-backed, controls concurrency)
        │
        ▼
Worker fires HTTP attacks  (axios, spoofed headers, SSRF guard)
        │
     ┌──┴──┐
     ▼     ▼
Prisma    WebSocket broadcast
(persist) (stream to browser)
```

Attack logs, status codes, and latency metrics are written to PostgreSQL via Prisma and simultaneously broadcast to all connected WebSocket clients subscribed to the test run. Plan quota is enforced as Express middleware before the queue is populated.

---

## API Reference

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <jwt>`.

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Create account (email + password) |
| `POST` | `/api/auth/signin` | Sign in, returns JWT |

### Test Runs

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/attack` | Submit an OpenAPI URL to start a new attack run |
| `POST` | `/api/test-runs` | Alias — create a test run directly |
| `GET` | `/api/test-runs` | List all test runs for the authenticated user |
| `GET` | `/api/test-runs/:id` | Get a test run's summary and all attack logs |
| `GET` | `/api/test-runs/:id/logs` | Get paginated attack logs for a test run |
| `POST` | `/api/test-runs/:id/abort` | Abort an in-progress run (drains BullMQ jobs) |
| `DELETE` | `/api/test-runs/:id` | Delete a historical test run |
| `GET` | `/api/test-runs/:id/export/pdf` | Download PDF report (Pro/Team only) |

### Billing

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/billing/subscribe` | Create a Razorpay subscription for a plan |
| `POST` | `/api/billing/cancel` | Cancel the active subscription |
| `POST` | `/api/billing/webhook` | Razorpay webhook receiver (signature-verified) |

### User & Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/user/me` | Get current user (id, email, plan, planExpiresAt) |
| `GET` | `/api/health` | Health check — returns `{ status: "ok" }` |

### WebSocket

Connect to `ws://<host>/ws` after authenticating. The server broadcasts attack-log events as JSON for each test run in progress.

---

## Contributing

1. Fork the repository and create a feature branch (`git checkout -b feat/my-feature`)
2. Make your changes — keep commits focused and descriptive
3. Run type checks before pushing:
   ```bash
   cd server && npm run typecheck
   cd ../client && npx tsc --noEmit
   ```
4. Open a pull request against `main` using the PR template

For bugs, use the **Bug Report** issue template. For new ideas, use **Feature Request**.

---

## License

MIT — see [LICENSE](LICENSE).

---

*Built by [Raghul AR](https://github.com/raghul017).*
