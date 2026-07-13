# Onyx — Master Implementation Plan

_File-level, sequenced build plan tailored to the actual codebase. Funding excluded — pure build._

Last updated: July 2026

---

## How we'll work (read this first)

This document is the single source of truth for the build. It's broken into **numbered tickets (T1, T2, …)** grouped into phases. We execute them **one at a time**:

1. You ask me for the next ticket. I hand you a **ready-to-paste Claude Code prompt** for exactly that ticket.
2. Claude Code implements it and, per the prompt, ends with a **standard summary block** (format defined below).
3. You paste that summary back to me. I **verify** it against this plan's acceptance criteria, flag anything missing, and either give you a fix-up prompt or the next ticket.

Do them in order — later tickets depend on data-model and job-schema changes made in earlier ones. Where a ticket is independent, it's marked **[parallel-ok]**.

### The summary block every Claude Code prompt will require

Each implementation prompt ends by asking Claude Code to output this, so verification is fast and consistent:

```
## SUMMARY — <ticket id>
- Files added: <paths>
- Files changed: <paths + one-line what changed>
- Schema/migration: <migration name, or "none">
- New config/env vars: <names + purpose, or "none">
- Tests added: <paths + what they cover>
- Manual test done: <command(s) run + result>
- Acceptance criteria met: <checklist, each ✅/❌>
- Deviations / TODOs / risks: <anything I changed from the plan and why>
```

If any acceptance box is ❌, tell me and stop — don't push forward.

---

## Guiding principles for the whole build

- **Behavior-locking before refactor.** You have essentially zero server tests. We add a safety net _before_ touching detection (T1), so we can change `finding-analysis.ts` without silent regressions.
- **Additive, not rewrite.** The three insertion points from your analysis — `attackJobDataSchema` (add `kind` + `identityId`), `producer.ts`/`worker.ts` (fan-out + branch), and the data model (`AuthRecipe`, per-log `identityId`, baseline storage) — are extended, not replaced. Diffing is a new layer on top of the existing rules, not a rewrite of them.
- **Every finding stays explained.** The explanation layer is the product's edge. Every new detection must produce the same category/cause/evidence/remediation/confidence shape.
- **Safety first.** New request behavior (auth material, injection into GET/DELETE) must respect the SSRF guard, redact secrets from stored snippets, and honor per-target rate/scope limits.

---

## Phase map

| Phase                      | Tickets | Outcome                                                           |
| -------------------------- | ------- | ----------------------------------------------------------------- |
| 0 — Foundation & safety    | T1–T3   | Tests, logging, migrations; safe to refactor                      |
| 1 — Injection correctness  | T4      | Payloads actually reach GET/DELETE + params, not just POST bodies |
| 2 — Baseline diffing       | T5–T6   | Confirm blind/time-based/boolean; kill false positives            |
| 3 — Authenticated scanning | T7–T8   | Test behind login — the biggest unlock                            |
| 4 — OWASP mapping          | T9      | Every finding named API1–API10                                    |
| 5 — Workflow (CLI + CI)    | T10–T11 | Fits the dev pipeline; recurring value                            |
| 6 — Multi-identity + BOLA  | T12–T14 | The differentiated moat                                           |
| 7 — Differentiators        | T15–T17 | Remediation depth, reports, integrations                          |
| 8 — Coverage & scale       | T18–T20 | More inputs, scheduling, horizontal workers                       |

---

# Phase 0 — Foundation & safety

## T1 — Server test harness + lock existing behavior

**Why:** zero server tests today; you're about to change detection. Lock current outputs first.
**Files:** add `server/vitest.config.ts` (or jest), `server/src/services/__tests__/finding-analysis.test.ts`, `severity.test.ts`, `run-score.test.ts`, `lib/__tests__/ssrf-guard.test.ts`. Add `test` script to `server/package.json`.
**What to build:** table-driven unit tests capturing the _current_ behavior of all 11 detection rules (one case each, plus edge cases: status 0/408/502/503, 5xx with/without injection attackType, reflected-XSS ≥6 chars, secret/file/SQL regex hits), the scoring math (deductions + label thresholds), and SSRF guard verdicts (private/loopback/link-local/CGNAT/metadata/IPv4-mapped-IPv6 all blocked; a normal public host allowed).
**Acceptance criteria:**

- `npm test` runs green in `server/`.
- Each of the 11 rules has at least one asserting test; scoring and SSRF have coverage.
- No production code changed (tests only).
  **[parallel-ok]** with T2.

## T2 — Structured logging, error tracking, and DB migrations

**Why:** can't run a paid service on `console.log`; `db push` risks data loss once you have customers.
**Files:** add a logger (`server/src/lib/logger.ts`, pino), replace `console.*` in `index.ts`, `worker.ts`, `producer.ts`, controllers. Add Sentry init in `index.ts` + worker. Convert Prisma to migrations: generate an initial migration from current schema, add `migrate deploy` to the start/deploy flow, document it.
**Env vars:** `SENTRY_DSN`, `LOG_LEVEL`.
**Acceptance criteria:**

- Structured JSON logs with request/run/job IDs on key paths.
- Errors in HTTP and worker report to Sentry.
- `prisma/migrations/` exists with an initial migration; app boots via `migrate deploy`; no schema drift.
- No behavior change to scanning.
  **[parallel-ok]** with T1.

## T3 — Secret redaction for stored responses [parallel-ok]

**Why:** `responseSnippet` stores raw target bytes (may capture secrets/PII) — a liability, especially before adding auth.
**Files:** `server/src/queues/worker.ts` (where snippet is captured), new `server/src/lib/redact.ts`.
**What to build:** a redaction pass over `responseSnippet` before persistence — mask JWTs, `api_key`/`secret`/`password` values, bearer tokens, private-key blocks, emails (configurable). Keep enough context for evidence (mask the value, keep the key name). Detection regexes in `finding-analysis.ts` run on the _pre-redaction_ body in-memory; only the _stored_ snippet is redacted (so we don't lose the finding but don't persist the secret). Add a unit test.
**Acceptance criteria:**

- Known secret patterns are masked in stored `responseSnippet`.
- Findings that rely on secret/file/SQL signatures still fire (detection uses in-memory body).
- Test proves both.

---

# Phase 1 — Injection correctness

## T4 — Fix payload placement (GET/DELETE + params, not just POST body)

**Why (critical bug from your analysis):** today the payload only reaches the target as a JSON body on POST/PUT/PATCH; GET/DELETE fire with a bare path and no injection. You are effectively not testing GET/DELETE at all, and not testing query/path/header params anywhere. This silently halves your real coverage.
**Files:** `server/src/queues/worker.ts` (`executeAttack` + call site), likely a new `server/src/services/request-builder.ts`; the producer/AI layer may need to pass the target parameter location.
**What to build:** a request builder that, given a `ParsedEndpoint` + payload + attackType, injects the payload into the _appropriate_ location(s):

- path params → substitute into `{param}` placeholders;
- query params → append/replace on the querystring (GET/DELETE especially);
- header params → set header;
- body → JSON body (existing behavior).
  Choose location by the endpoint's declared parameters (from the parser) and attack type (e.g., path traversal → path/query; SQLi → any string param or body; oversized → body). When an endpoint has no body and no params, still fire a baseline-style request so it's represented. Keep SSRF guard + 10s timeout + UA header.
  **Data/interfaces:** extend the job data or the AI payload shape to carry an optional `targetParam`/`location` so the worker knows where to inject (coordinate with `ai-payload.ts` — you can have Gemini name the target parameter, with a deterministic fallback that iterates injectable params).
  **Acceptance criteria:**
- GET and DELETE endpoints receive payloads in query/path params.
- Query/path/header params are injectable, not just body.
- Existing POST/PUT/PATCH body injection still works.
- Unit tests for the request builder cover each location.
- No SSRF/timeout regression.

---

# Phase 2 — Baseline diffing (your deferred Phase-2)

## T5 — Baseline capture (job kind + storage)

**Why:** prerequisite for confirming blind/boolean/time-based issues and for cutting false positives.
**Files:** `server/src/queues/chaos-queue.ts` (`attackJobDataSchema`: add `kind: "attack" | "baseline"` default `"attack"`), `server/src/queues/producer.ts` (enqueue one baseline job per endpoint _before_ its attack jobs; update the `enqueuedAt` completion-gate math to include baseline jobs), `server/src/queues/worker.ts` (branch on `kind`; for `baseline`, send one benign, schema-valid request and store the result), schema: new `BaselineResponse { id, testRunId, endpointId, status, latencyMs, bodyLength, bodySnippet, createdAt }` (or add `baseline*` columns to `TargetEndpoint`). New migration.
**What to build:** for each endpoint, a benign control request using schema-valid dummy values (no attack payload); capture status, latency (median of 2–3 fires to reduce noise), body length, and a redacted body snippet/shape. Persist it. Attack jobs for that endpoint must be able to look it up.
**Acceptance criteria:**

- Each endpoint has a stored baseline before its attack results are analyzed.
- Completion gate still fires correctly (run reaches COMPLETED) with the extra jobs.
- Baseline requests respect SSRF/timeout/redaction.
- Feature flag/plan-gate: baseline capture can be toggled per run (default on for Pro, off/limited for Free).

## T6 — Diffing layer in finding-analysis (multi-signal + time-based)

**Why:** upgrades detection from single-response to evidence-based; confirms blind SQLi/command injection and reduces reflected-XSS false positives.
**Files:** `server/src/services/finding-analysis.ts` (accept an optional `baseline` argument; add diff-based rules), its call site in `worker.ts` (pass the endpoint's baseline), tests.
**What to build (additive — existing rules stay):**

- Pass `baseline {status, latencyMs, bodyLength, bodySnippet}` into `analyzeFinding`.
- **Time-based:** if attack latency exceeds baseline by a threshold (e.g., ≥ 4s over baseline on a `SLEEP`-style payload) consistently, emit confirmed blind/time-based injection.
- **Boolean/blind:** significant body-length or shape delta vs baseline on injection payloads → firm/confirmed.
- **False-positive reduction:** for reflected XSS, only confirm if the payload appears in the attack body but **not** in the baseline body (i.e., genuinely reflected because of _our_ input).
- **500-vs-baseline:** a 5xx that the baseline didn't produce is stronger evidence than a 5xx alone.
- Produce the same finding shape; include the baseline comparison in `evidence` text ("baseline 120ms → attack 5,140ms").
  **Acceptance criteria:**
- New tests: time-based confirmed via latency delta; blind boolean via length delta; reflected-XSS false positive suppressed when reflection is present in baseline.
- All T1 behavior-lock tests still pass (or are intentionally updated with a noted reason).
- When no baseline exists, behavior falls back to today's single-request rules (backward compatible).

---

# Phase 3 — Authenticated scanning (the biggest unlock)

## T7 — Read securitySchemes + attach static credentials

**Why:** you can't test behind auth today; `securitySchemes` are ignored and no credential is attached.
**Files:** `server/src/services/openapi-parser.ts` (extract global + per-operation `security` and `securitySchemes`), schema: new `AuthRecipe { id, ownerScope (userId/orgId), name, type: "header" | "bearer" | "apiKey" | "cookie", config Json, createdAt }` + `authRecipeId String?` on `TestRun`; new migration. `server/src/services/request-builder.ts` + `worker.ts` (attach credential to every request). Routes/controller: CRUD for auth recipes; `POST /api/test-runs` accepts an optional `authRecipeId`. Client: a minimal "Authentication" section on the new-scan form + a settings page to manage recipes.
**What to build:** let a user define a static credential (bearer token, header key/value, API-key in header or query, or cookie) and attach it to a run. The worker adds it to each request (in addition to injecting the payload). Store credential config encrypted (add an app-level encryption helper); never log it; redaction from T3 covers snippets.
**Acceptance criteria:**

- Parser surfaces whether/what auth each endpoint expects.
- A run with an `authRecipeId` sends the credential on every request.
- Credential material is encrypted at rest and never appears in logs or stored snippets.
- The existing `MISSING_AUTH` attack still runs (and now means something: authed baseline vs stripped-auth attack).
- CRUD + form wiring works end to end.

## T8 — Login recipe + token refresh

**Why:** many APIs need a login call to obtain a token, and long scans die when tokens expire.
**Files:** extend `AuthRecipe.type` with `"loginRequest"` + `"oauth2ClientCredentials"`; `server/src/services/auth-runner.ts` (new — executes the login/token call, extracts the token via a JSONPath/regex from config, caches it for the run); `worker.ts` (on 401 mid-run, re-run auth-runner and retry once).
**What to build:** (a) OAuth2 client-credentials: Onyx POSTs to a token URL with client id/secret, reads `access_token`. (b) Login-request recipe: user defines a request + where the token lives in the response; Onyx runs it, extracts, reuses. (c) 401 handling: detect, refresh, retry, then give up gracefully.
**Acceptance criteria:**

- A login-request recipe yields a token that authenticates subsequent requests.
- OAuth2 client-credentials flow works against a standard token endpoint.
- A simulated mid-run 401 triggers exactly one refresh+retry.
- Tokens are cached per run, encrypted, never logged.

---

# Phase 4 — OWASP API Top 10 mapping

## T9 — Model + surface OWASP API Top 10 categories

**Why:** buyers check this box; today `attackType` is a free string with no OWASP mapping.
**Files:** shared types + Zod (`OwaspApiCategory` enum: API1_BOLA … API10_UNSAFE_CONSUMPTION), schema: add `owaspCategory String?` to `AttackLog` (+ migration), `finding-analysis.ts` (set the category per finding), `pdf.service.ts` + client `FindingDetailPanel`/Report page (display the named category, group findings by it). A mapping table from existing `attackType` + rule → OWASP category.
**What to build:** deterministic mapping (e.g., SQLi→API8/injection context, missing/broken auth→API2, access-control 2xx→API1/API5 once BOLA exists, SSRF→API7, verbose errors/misconfig→API8, oversized/rate-limit→API4). Show category badges in UI and a "coverage by OWASP API Top 10" section in the report.
**Acceptance criteria:**

- Every finding carries an OWASP API category.
- UI and PDF display and group by it.
- A documented mapping table exists; tests assert representative mappings.
  **[parallel-ok]** with Phase 5.

---

# Phase 5 — Workflow: CLI + CI

## T10 — Onyx CLI

**Why:** the atom for CI; every serious competitor ships one.
**Files:** new package `cli/` (Node + TypeScript, published as `@onyx/cli` or a binary), talking to your existing REST API with an API token. Add API-token auth to the server (new `ApiToken` model + middleware) so the CLI can authenticate non-interactively.
**What to build:** `onyx scan --spec <url|file> [--auth-recipe <id>] [--fail-on critical|high|medium|low] [--format table|json|sarif] [--out <file>]`. It creates a run, polls (or streams) to completion, prints a summary, writes JSON/SARIF, and sets exit code by the `--fail-on` threshold. Add `--api-token`/`ONYX_TOKEN` env.
**Acceptance criteria:**

- CLI creates a run and returns findings.
- `--fail-on high` exits non-zero when a ≥high finding exists, zero otherwise.
- `--format sarif` emits valid SARIF; `--format json` emits structured findings.
- API-token auth works and is documented.

## T11 — GitHub Action + PR checks

**Why:** "fail the build / comment on the PR" is the feature dev buyers actually want.
**Files:** new `action.yml` + a thin wrapper (or Docker action) calling the T10 CLI; a `.github/workflows/` example; docs.
**What to build:** an Action that runs the CLI against a repo's spec, posts a PR comment/check summarizing findings with a link to the full Onyx report, and fails the check per threshold. Upload SARIF so it shows in GitHub's Security tab.
**Acceptance criteria:**

- Action runs in a sample repo, comments on a PR, and fails on threshold.
- SARIF upload renders in the Security tab.
- README with copy-paste usage.
  **[parallel-ok]** after T10.

---

# Phase 6 — Multi-identity + BOLA (the moat)

## T12 — Multiple identities per run

**Why:** prerequisite for BOLA/BFLA; today a run has one anonymous identity.
**Files:** schema: allow N identities per run (join `RunIdentity { id, testRunId, authRecipeId, label }`), add `identityId String?` to `AttackLog` (+ migration); `attackJobDataSchema` (add `identityId`); `producer.ts` (fan out selected attacks per identity); `worker.ts` (use the right credential per `identityId`); UI to attach 2+ recipes with labels (e.g., userA, userB, admin, anon).
**Acceptance criteria:**

- A run can define ≥2 identities; results are attributable per identity (`AttackLog.identityId`).
- Fan-out enqueues per-identity jobs correctly; completion gate accounts for them.
- Backward compatible: a single-identity run behaves as today.

## T13 — BOLA/IDOR engine

**Why:** #1 on the OWASP API Top 10; the flagship differentiator, and it fits "explain it" perfectly.
**Files:** new job `kind: "replay"`; `server/src/services/bola-engine.ts`; `worker.ts` branch; `finding-analysis.ts` (or a dedicated authz analyzer) for cross-identity comparison; uses Gemini for interpretation.
**What to build:** with identities A and B — detect object-ID-shaped params (sequential ints/UUIDs) in path/query/body (leverage the parser); as A, capture a resource + its object ID and its response body; as B, replay the same request with A's ID; if B receives 2xx **and** the response contains A's private data (compare/interpret via Gemini + body diff), emit a **confirmed BOLA** finding with both requests side-by-side as evidence and a plain-English explanation of why B could read A's data.
**Acceptance criteria:**

- Given a deliberately-vulnerable test API, BOLA is detected with A/B evidence.
- Given a properly-authorized API, no false BOLA (B gets 403/404 → no finding).
- Finding includes side-by-side requests + explanation + remediation; mapped to API1.
- Runs only when ≥2 identities are configured; degrades cleanly otherwise.

## T14 — BFLA, mass assignment, excessive data exposure

**Why:** rounds out the authorization/business-logic suite (API3/API5/API6).
**Files:** extend `bola-engine.ts` / new `authz-checks.ts`; worker branches; analyzer additions.
**What to build:**

- **BFLA (API5):** replay admin-only endpoints as a low-priv identity; 2xx → finding.
- **Mass assignment (API6/API3):** add unexpected fields (`role:admin`, `isVerified:true`) to write requests; confirm persistence via a follow-up read.
- **Excessive data exposure (API3):** compare returned fields to the schema's expected fields via Gemini; flag over-returned sensitive fields.
  **Acceptance criteria:**
- Each check has a positive and negative test against fixtures.
- Findings are explained, mapped to the right OWASP category, and confidence-scored.

---

# Phase 7 — Differentiators

## T15 — Framework-specific remediation + fix re-scan

**Files:** `finding-analysis.ts`/a remediation service (curated fix templates per framework: Express, FastAPI, Spring, Rails, Django, Laravel, keyed by finding category), Gemini fills specifics from a template (not free-form, to avoid hallucination); new endpoint + job to re-run a single finding and mark it resolved; UI "re-scan this finding" + resolved state.
**Acceptance criteria:** framework-targeted fix snippets render per finding; re-scan flips a fixed finding to resolved; templates are curated, not hallucinated.

## T16 — Shareable + compliance reports + trend views [parallel-ok]

**Files:** tokenized public report links (new `ReportShare` model + route), PDF/report additions (OWASP API Top 10 coverage section, SOC 2/ISO control language), History/trend view using the denormalized `overallScore` over time; new-vs-resolved per scan.
**Acceptance criteria:** a shareable link renders a read-only report; report shows OWASP coverage + compliance framing; trend chart shows score history and new/resolved deltas.

## T17 — Webhooks + Slack/Jira [parallel-ok]

**Files:** outbound webhook model + delivery (on run-complete / finding-created, signed payloads, retries), Slack notify (incoming webhook), optional Jira issue creation; settings UI.
**Acceptance criteria:** webhook fires with a signed payload and retries on failure; Slack message posts on run completion; (optional) Jira issue created from a finding.

---

# Phase 8 — Coverage & scale

## T18 — More inputs: Postman/HAR import + GraphQL

**Files:** new parsers alongside `openapi-parser.ts` (`postman-parser.ts`, `har-parser.ts`, `graphql-introspect.ts`) producing the same `ParsedEndpoint[]` (for GraphQL, model operations as endpoints); spec **upload** (not just URL); AI payload prompt variants for GraphQL (nested-query DoS, injection, authz).
**Acceptance criteria:** a Postman collection and a HAR file each produce a scan; GraphQL introspection yields testable operations; upload path works for non-public specs.

## T19 — Scheduled / continuous scans + regression alerts [parallel-ok]

**Files:** schedule model + a scheduler (cron/queue-repeat), diff-since-last-run, regression alert when a resolved finding reappears; notify via T17 channels.
**Acceptance criteria:** a target scans on a schedule; "N new since last scan" is computed; reappearing fixed findings alert.

## T20 — Worker as a separate process + scale

**Why:** worker currently runs in the HTTP process (no horizontal scaling); `drainTestRunJobs` scans the whole queue on abort.
**Files:** split `startOnyxWorker()` into its own entrypoint/deploy target; replace whole-queue drain with targeted job removal by `jobId` prefix; add Redis read-caching where hot.
**Acceptance criteria:** worker runs as an independent, horizontally-scalable process; abort/delete removes only that run's jobs; no functional regression.

---

## Cross-cutting backlog (fold in as you go)

- Raise/relax the 20-endpoint cap per plan (`MAX_ENDPOINTS`) once throughput scales (T20).
- Per-target request budget + concurrency cap ("safe by design") — good marketing, real safety.
- OAST/out-of-band callback detection for blind SSRF/XXE/RCE (bigger bet; after Phase 6).
- LLM endpoint testing (OWASP LLM Top 10) and MCP-server testing — new attack-type packs once the engine is multi-signal + authed.
- Public "watch it attack" sandbox playground (marketing + product).
- Self-hosted/VPC worker runner for security-conscious buyers.

---

## Suggested execution order (the short list)

If you just want the path: **T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14**, then pick from Phase 7/8 by what your early users ask for.

That takes Onyx from "single-request spec scanner" to "authenticated, evidence-based, CI-integrated BOLA scanner that explains itself" — which is a product a real team pays for and a category few solo builders reach.

When you're ready, ask me for **"the T1 prompt"** (or any ticket) and I'll give you the exact Claude Code prompt, ending with the required summary block. Paste the summary back and I'll verify and hand you the next one.
