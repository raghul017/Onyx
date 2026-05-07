# 🚀 Onyx — Startup Readiness Roadmap

> **Current State**: Solid technical core — AI payload generation, BullMQ/Redis queue, WebSocket telemetry, PostgreSQL persistence, JWT auth, WAF bypass, SSRF guard.
> **Goal**: Evolve from a powerful personal tool into a fundable, revenue-generating B2B SaaS.

---

## 🏦 Pillar 1 — Monetization & Billing (Revenue Engine)

The single most important thing for a startup. Without this, you have a demo, not a business.

### 1.1 Subscription Tiers
Define clear plans that limit and upsell:

| Plan | Price | Test Runs/mo | Endpoints/run | Features |
|------|-------|-------------|--------------|---------|
| **Free** | $0 | 5 | 10 | 5 attack types |
| **Pro** | $29/mo | 100 | 50 | All attack types, PDF reports |
| **Team** | $99/mo | 500 | Unlimited | Multi-user, API access |
| **Enterprise** | Custom | Unlimited | Unlimited | SSO, SLA, on-prem |

**What to build:**
- Stripe integration (subscriptions + usage-based billing)
- Usage metering middleware that checks plan limits before each test run
- Billing dashboard page in-app
- Upgrade/downgrade flows
- Webhook handler for payment events (failed payments → grace period → downgrade)

**Files to add:**
```
server/src/services/billing.service.ts     ← Stripe SDK wrapper
server/src/middleware/quota.middleware.ts   ← Enforces plan limits
client/src/pages/Billing.tsx               ← Subscription management UI
```

---

### 1.2 Usage-Based Add-ons
- **Extra test credits** — buy 50 extra runs for $5
- **Scheduled Scans** — cron-based recurring tests ($19/mo add-on)
- **Priority Queue** — skip the worker queue for instant execution

---

## 👥 Pillar 2 — Multi-Tenancy & Team Features

Every B2B SaaS sale involves multiple stakeholders. You need organizations, not just users.

### 2.1 Organization / Workspace Model
Currently: `User → TestRun` (1:many)
Need: `Org → Users → TestRun` (multi-tenant)

**Schema additions to Prisma:**
```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  plan      Plan     @default(FREE)
  members   OrgMember[]
  testRuns  TestRun[]
}

model OrgMember {
  userId  String
  orgId   String
  role    OrgRole  // OWNER | ADMIN | VIEWER
}
```

### 2.2 Role-Based Access Control (RBAC)
- **Owner**: full access, billing management
- **Admin**: run tests, view reports, manage members
- **Viewer**: read-only access to reports and history

### 2.3 Team Collaboration Features
- Share test run reports via a public link (like Loom)
- Comment threads on specific attack results
- Assign findings to team members (like GitHub Issues)
- Slack / Teams notifications when critical vulns are found

---

## 🔒 Pillar 3 — Security, Compliance & Trust

Enterprise buyers will ask for this. Having it = more closed deals.

### 3.1 Responsible Disclosure Policy
- Add a `/security` page with your Coordinated Vulnerability Disclosure policy
- Define what targets are legal to scan (own APIs, authorized APIs only)
- Terms of Service with explicit acceptable use policy

### 3.2 Audit Logging
Every security-sensitive action must be logged immutably:
- Who created a test run, when, from what IP
- Who accessed a report
- Who modified org settings

```prisma
model AuditLog {
  id        String   @id
  userId    String
  orgId     String
  action    String   // "TEST_RUN_CREATED", "REPORT_EXPORTED"
  metadata  Json
  createdAt DateTime
}
```

### 3.3 SOC 2 Type II Readiness
Not needed on day 1, but architecture decisions now make it much easier later:
- All PII encrypted at rest (Neon handles this, verify it's on)
- All API comms over TLS (enforce HTTPS-only)
- Secret management via environment vault (not plain `.env` in prod)

### 3.4 Target Authorization Verification
Before firing attacks, require proof the user owns the target:
- Upload a `onyx-verify.txt` file to the target domain's root
- Or add a DNS TXT record (`onyx-verify=<token>`)
- This is critical for legal protection and enterprise trust

---

## 📈 Pillar 4 — Growth & Distribution

Great product means nothing if no one finds it.

### 4.1 Public Landing Page (Production-Grade)
The current landing page needs to convert visitors into signups:
- Clear above-the-fold value prop: **"Find API vulnerabilities before hackers do"**
- Live demo (embed a read-only dashboard showing a real scan)
- Pricing table
- Social proof: logos, testimonials, GitHub stars
- Blog / changelog section for SEO

### 4.2 Developer-Focused Growth Levers
- **GitHub-first**: Make the repo public, add a stunning README with a GIF demo
- **CLI Tool**: `npx onyx-scan https://api.example.com/openapi.json` — this alone can go viral on HN/Reddit
- **REST API access** (Pro+): Let developers integrate Onyx into their CI/CD pipelines
- **VS Code Extension**: Scan APIs directly from the IDE

### 4.3 API-First Integration
Expose a public API so Onyx can be embedded in DevSecOps workflows:
```http
POST https://api.onyxsec.io/v1/test-runs
Authorization: Bearer <api_key>
Content-Type: application/json

{ "specUrl": "https://your-api.com/openapi.json" }
```

This enables:
- GitHub Actions integration (scan on every PR)
- Postman plugin
- Jenkins / GitLab CI integration

---

## 🛠️ Pillar 5 — Product Completeness (Missing Features)

### 5.1 Export & Reporting (Critical Gap)
Currently: results are only visible in the dashboard.
Need:
- **PDF Report Export** — branded, executive-friendly vulnerability report
- **JSON/CSV Export** — for security teams to import into Jira/Linear
- **GitHub Issues Integration** — auto-create issues from critical findings
- **SARIF format export** — standard security results format (GitHub Security tab compatible)

### 5.2 Vulnerability Severity Scoring
Currently: results are color-coded by status code.
Need proper **CVSS scoring** per finding:
- Critical / High / Medium / Low / Info classification
- Severity based on attack type + response code + data leaked
- Overall API security score (0-100) per test run

### 5.3 Scheduled & Continuous Scanning
- Cron-based re-scanning (daily, weekly) of saved API specs
- Regression detection: "This endpoint was secure last week, now it's vulnerable"
- Email/Slack alerts on new vulnerabilities discovered

### 5.4 Custom Payload Rules
- Let Pro users define their own payload templates
- Import/export payload libraries (YAML format)
- Industry-specific payloads (Healthcare FHIR APIs, Fintech PCI-DSS APIs)

### 5.5 Diff View (Regression Testing)
Compare two test runs side-by-side:
- "New vulnerabilities since last scan: 3"
- "Fixed vulnerabilities since last scan: 12"
- Timeline chart of security posture over time

### 5.6 Onboarding Flow
New users need a guided first-run experience:
- Interactive tutorial using a safe demo API (PetStore Swagger)
- Checklists and tooltips explaining what each attack type means
- Empty states that guide users to their first scan

---

## ⚙️ Pillar 6 — Infrastructure & DevOps (Production Hardiness)

### 6.1 Observability Stack
You need to know when things break before customers do:
- **Error tracking**: Sentry (both frontend and backend)
- **Metrics & APM**: Datadog or OpenTelemetry → Grafana
- **Logging**: Structured JSON logs → Logtail / Axiom
- **Uptime monitoring**: Betterstack / Checkly

### 6.2 CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
on: [push to main]
jobs:
  test → lint → build → deploy
```
- Automated tests on every PR (Vitest is already configured!)
- Preview deployments for PRs (Vercel already handles the frontend)
- Backend auto-deploy to Railway / Fly.io / Render

### 6.3 Horizontal Scaling for Workers
Currently: workers run inside the same Node process.
For production load, extract workers into separate auto-scaling instances:
- **Railway Workers** or **AWS ECS** for BullMQ workers
- This lets you scale workers independently of the API server
- Use Redis Cluster for high-availability queue

### 6.4 Rate Limiting & DDoS Protection
- Move from per-IP rate limiting to per-user/per-org limits
- Add Cloudflare in front of the API for DDoS protection
- Bot detection on auth endpoints

---

## 📋 Recommended Build Order (MVP → Product-Market Fit)

```
Phase 1 — Revenue Foundation (Month 1-2)
  ✦ Stripe billing + 3 tiers
  ✦ Usage quota middleware
  ✦ PDF report export
  ✦ Public landing page with pricing

Phase 2 — Enterprise Readiness (Month 3-4)
  ✦ Organization / team model
  ✦ RBAC
  ✦ Audit logs
  ✦ Target authorization verification

Phase 3 — Growth Engine (Month 5-6)
  ✦ Public REST API + API keys
  ✦ CLI tool (npx onyx-scan)
  ✦ GitHub Actions integration
  ✦ Scheduled scanning

Phase 4 — Retention & Depth (Month 7+)
  ✦ CVSS scoring
  ✦ Diff / regression view
  ✦ Custom payload rules
  ✦ SOC 2 readiness audit
```

---

## 💡 Positioning Advice

**Current positioning**: "AI-powered API chaos testing tool"
**Sharper positioning**: **"The automated API security scanner for dev teams that ship fast"**

**Competitive moats to lean into:**
1. **AI-native**: Most scanners use static wordlists. Onyx uses Gemini to generate context-aware payloads — this is genuinely novel.
2. **Real-time streaming**: The live telemetry WebSocket experience is more visceral and impressive than any scan report PDF.
3. **Developer-first**: CLI + API + CI/CD integration puts you in the developer workflow, not the CISO's email inbox.

**Comparable companies for inspiration:**
- [Escape.tech](https://escape.tech) — GraphQL security testing SaaS
- [Bright Security](https://brightsec.com) — AI-powered DAST
- [42Crunch](https://42crunch.com) — API security platform

---

*Generated: 2026-04-28 | Onyx Project Analysis*
