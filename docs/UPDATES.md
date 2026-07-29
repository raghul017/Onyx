# Updates

Append-only log of implementation tickets. Newest at the bottom.

## 2026-07-13 — T4: Payload placement fix + request builder

Attack payloads now reach GET/DELETE and path/query/header params (not just POST
bodies), and `{placeholder}` path segments are always resolved — closing the gap
where GET/DELETE fired bare paths and literal `{id}` braces were sent. One
payload still equals one request; job cardinality and the completion gate are
unchanged.

- **Added:** `server/src/services/request-builder.ts` (`buildAttackRequest` — decides where the payload goes by attack type), `server/src/services/__tests__/request-builder.test.ts`.
- **Changed:** `server/src/validators/schemas.ts` (job carries optional `parameters` + `requestBodySchema`), `server/src/queues/producer.ts` + `server/src/controllers/test-run.controller.ts` (thread param defs from the in-memory parsed endpoint), `server/src/queues/worker.ts` (build request via the builder; SSRF now vets the final resolved URL; timeout/redaction/detection unchanged).
- **Migration:** none (chose option (a) — params travel on the job; no Prisma/schema change).
- **Docs housekeeping:** moved tracked root markdown into `docs/` (AGENTS, OAUTH_SETUP, WORKFLOW, PROGRESS, changelog, PLAN-dashboard-instrument, Onyx-Master-Implementation-Plan); fixed internal links.

## 2026-07-28 — T5: Baseline capture (job kind + BaselineResponse)

Each endpoint now gets ONE benign control request (no attack payload), captured
as a `BaselineResponse` so T6 can diff attacks against it. Baseline jobs run at
higher priority and are tracked separately, so a run completes only after
attacks AND baselines finish while the UI attack counts stay attack-only.
Baseline capture is plan-gated: ON for paid plans, skipped on FREE. Attack
detection does NOT consume the baseline yet (that's T6).

- **Added:** `server/src/services/run-completion.ts` (pure `isRunComplete` gate), `server/src/services/__tests__/run-completion.test.ts`; `buildBenignRequest` in `request-builder.ts` (+ tests).
- **Changed:** `schema.prisma` (new `BaselineResponse` model, unique `(testRunId,endpointId)`; `TestRun.totalBaselines`/`completedBaselines`), `validators/schemas.ts` (`kind: attack|baseline` on the job), `queues/producer.ts` (`enqueueBaselineJobs` + baseline/attack priorities), `controllers/test-run.controller.ts` (plan-gate + enqueue baselines + `isRunComplete`), `queues/worker.ts` (branch on `kind` → `processBaselineJob`: median-of-3 latency, redacted snippet, upsert; extended completion gate + failed-job routing).
- **Migration:** `20260728135549_baseline_capture` (additive: ADD COLUMN + CREATE TABLE `baseline_responses`; applied via `migrate deploy`, status clean).
- **Docs housekeeping:** moved `AGENTS.md` back to repo root (agent tooling reads it there); fixed cross-links.

## 2026-07-28 — T6: Baseline diffing in finding-analysis (multi-signal + time-based)

Detection is now evidence-based: each attack response is diffed against the
endpoint's benign baseline to **confirm time-based/blind injection** (sleep
payload + latency delta ≥4s), flag **likely blind injection** on a material
body-length delta (conservative firm MEDIUM), **suppress reflected-XSS false
positives** when the baseline already echoes the marker, and **normalize 5xx**
that the baseline also produced. With **no baseline the result is byte-identical
to pre-T6** (all T1 lock tests pass unchanged). Scoring math and the request path
are untouched.

- **Added:** T6 test block in `server/src/services/__tests__/finding-analysis.test.ts` (time-based, blind length-delta, XSS FP, 5xx normalization, null-baseline back-compat).
- **Changed:** `server/src/services/finding-analysis.ts` (extracted the 11 rules into `analyzeBase`; `analyzeFinding(input, baseline?)` adds the additive diff layer with named thresholds + `BaselineComparison` type + `bodyLength` on `FindingInput`); `server/src/queues/worker.ts` (capture `bodyLength`; cached per-(run,endpoint) `getBaselineFor` lookup; pass baseline into `analyzeFinding`).
- **Migration:** none.

## 2026-07-28 — T7a: Authenticated scanning backend (AuthRecipe, encryption, CRUD, credential attach)

Users can define a **static credential** (bearer / apiKey / header / cookie) and
attach it to a run so **every request** (baseline + attack) carries it. Secrets
are **encrypted at rest (AES-256-GCM)**, never logged, and never returned in full
(masked to `••••<last4>`). The parser now surfaces **per-endpoint auth
requirements** from the spec. `MISSING_AUTH` attacks fire **without** the
credential so a 2xx genuinely means missing enforcement. No plaintext secret ever
enters Redis — the recipe id rides on the `TestRun` row and is decrypted only
in-memory in the worker (cached). UI is deferred to T7b.

- **Added:** `server/src/lib/crypto.ts` (+ test), `server/src/services/auth-recipe.service.ts` (+ test), `server/src/controllers/auth-recipe.controller.ts`, `server/src/routes/auth-recipe.routes.ts`.
- **Changed:** `openapi-parser.ts` (extract `securitySchemes`/`security` → `authRequirements`), `request-builder.ts` (`AttachedCredential` + `applyCredential`; MISSING_AUTH strips it; baselines authed), `queues/worker.ts` (resolve+decrypt recipe from the run, cached; attach to attack+baseline; scrub the exact secret from stored/broadcast snippets), `controllers/test-run.controller.ts` (accept + ownership-check `authRecipeId`, persist `authRequirements`), `validators/schemas.ts` (recipe + `authRecipeId` schemas), `routes/index.ts` (register), `.env.server.example` (`CREDENTIAL_ENC_KEY`).
- **Env:** `CREDENTIAL_ENC_KEY` (32-byte base64/hex) — required to create/use recipes; missing key fails loudly.
- **Migration:** `20260728144528_auth_recipes` (additive: `auth_recipes` table, `test_runs.authRecipeId`, `target_endpoints.authRequirements`; applied via `migrate deploy`, status clean).

## 2026-07-28 — T7b: Auth recipe management UI + scan attach (client)

The client half of authenticated scanning. A **Credentials** section in Settings
lists/creates/edits/deletes auth recipes (bearer / apiKey / header / cookie) with
type-specific fields, using TanStack Query. Secrets are **write-only**: shown only
as `••••last4`, and on edit the secret field is blank ("leave blank to keep
current secret") so the plaintext never round-trips back. The **new-scan launch
bar** gains an optional **Authentication** dropdown to attach a recipe
(`authRecipeId` sent with the run), or an "Add auth" link to Settings when none
exist. Light-mono styling throughout; no backend changes beyond client bindings.

- **Added:** `client/src/components/AuthRecipesPanel.tsx` (+ pure helpers `buildRecipeMeta` / `buildRecipeUpdatePayload`), `client/src/test/auth-recipe-form.test.ts`.
- **Changed:** `client/src/services/api.ts` (auth-recipe types + CRUD bindings; optional `authRecipeId` on `createTestRun`), `client/src/pages/Settings.tsx` (render Credentials panel), `client/src/pages/Dashboard.tsx` (Authentication dropdown → `authRecipeId`).
- **Skipped (noted):** per-endpoint "expects bearer" badge — `getTestRun` returns logs from `AttackLog` and doesn't expose `TargetEndpoint.authRequirements`, so surfacing it cleanly would require a backend response change (out of T7b scope).

## 2026-07-28 — T8a: Dynamic auth (login-request + oauth2) + 401 refresh (backend)

Two DYNAMIC credential types that obtain a token at scan time and attach it like
a bearer/header: **oauth2ClientCredentials** (POST a token URL) and
**loginRequest** (fire a user-defined request, substitute `{{placeholder}}`
values from the encrypted secret, extract the token via dot-path OR `/regex/`).
The token is resolved once per run with **single-flight** (concurrent jobs → one
login) and, on a mid-run **401**, refreshed **exactly once** and the request
retried once, then it gives up gracefully (no loops, no compounding with BullMQ
retries). Every login/token request goes through the **SSRF guard + 10s timeout**;
the secret/token are never logged or stored (scrubbed from snippets). `MISSING_AUTH`
still fires un-authenticated; static recipes never auto-refresh.

- **Added:** `server/src/services/auth-runner.ts` (dynamic token resolution, SSRF-guarded), `server/src/services/credential-resolver.ts` (single-flight cache + `executeWithAuthRefresh`), tests: `auth-runner.test.ts`, `credential-resolver.test.ts` (+ dynamic-masking cases in `auth-recipe.service.test.ts`).
- **Changed:** `validators/schemas.ts` (extend type enum + dynamic meta fields + string|object secret union + per-type validation), `services/auth-recipe.service.ts` (`isDynamicType`, `buildRecipeStorage` `includeLast4` opt, `maskRecipe` passes through non-secret meta minus last4), `controllers/auth-recipe.controller.ts` (JSON-stringify object secrets, dynamic meta defaults, no last4 for dynamic), `queues/worker.ts` (use `CredentialResolver` + `executeWithAuthRefresh` for attack + baseline; scrub original + refreshed token).
- **Migration:** none — `AuthRecipe.type` is a plain `String` column, so the new values need no DDL (confirmed: `prisma migrate diff` → "No difference detected").

## 2026-07-28 — T8b: Dynamic auth recipe UI (login-request + oauth2) (client)

The client form for the two DYNAMIC credential types from T8a. The Credentials
form now offers **Login request** and **OAuth2 client credentials** in the type
selector with type-specific fields — oauth2: tokenUrl / clientId / scope? /
tokenResponseField? / injectAs / clientSecret; loginRequest: method / url /
optional headers / bodyTemplate (JSON with `{{placeholder}}` helper) / tokenPath
(dot-path or /regex/) / injectAs / per-placeholder secret values (derived live
from the template). Dynamic secrets are sent as an **object** (`{ clientSecret }`
or the placeholder map); static stay strings. Secrets are write-only — on edit
the fields are blank and omitted unless re-entered (object-aware). Field names
match the server Zod exactly; light validation (required fields, valid-JSON body,
non-empty tokenPath) before submit. The list shows the new types with a masked
secret + a non-secret meta summary (tokenUrl / method+url). No backend changes.

- **Changed:** `client/src/services/api.ts` (extend type union + `AuthRecipeMeta` dynamic fields + `AuthRecipeSecretInput` string|object secret), `client/src/components/AuthRecipesPanel.tsx` (unified fields state; oauth2 + loginRequest forms; pure helpers `buildRecipeSecret` / object-aware `buildRecipeUpdatePayload` / `isSecretBlank` / `extractPlaceholders` / `isValidJson` / `validateMetaForType`), `client/src/test/auth-recipe-form.test.ts` (dynamic object-secret, edit-keep-blank, JSON/placeholder cases).
- **Migration:** none.

## 2026-07-29 — T9a: OWASP API Top 10 mapping + persist + PDF coverage (backend)

Every finding now carries an OWASP API Security Top 10 (2023) code as ADDITIVE
context — the specific finding name (category/title/severity) is unchanged. The
2023 taxonomy has no standalone injection category, so SQLi/XSS/traversal fold
under API8. A single documented mapping module is the source of truth; the code
is persisted on `AttackLog` and included in the live broadcast; the PDF gains a
"Coverage by OWASP API Top 10" section counting findings per category.

Resolved mapping table (finding category / attack type → code):
- Sensitive Data Exposure → **API3**
- Broken Authentication / Access Control, and any MISSING_AUTH/*BYPASS* probe → **API2**
- OVERSIZED_PAYLOAD / RATE_LIMIT (any result, incl. 5xx/handled) → **API4**
- Path Traversal, SQL Injection, Reflected XSS, Blind/Time-Based Injection, Likely Blind Injection, Unhandled Server Error, Verbose Error / Info Disclosure → **API8**
- SQL_INJECTION / XSS / PATH_TRAVERSAL / TYPE_CONFUSION / BOUNDARY probe with a benign result → **API8**
- Request Error (transport failure); Handled / Access Control Enforced / Input Rejected with UNKNOWN attack type → **null (Unmapped)**
- Reserved (no current finding): BOLA→API1, BFLA→API5, mass-assignment→API3/API6, SSRF→API7, API9/API10.

- **Added:** `server/src/services/owasp-mapping.ts` (single source of truth: `mapFindingToOwasp` + `OWASP_API_CATEGORIES` + `OWASP_LABELS`), `server/src/services/__tests__/owasp-mapping.test.ts`.
- **Changed:** `types/shared.ts` (`OwaspApiCategory` type + `owaspCategory?` on `FindingDetail`), `validators/schemas.ts` (`owaspApiCategoryEnum`), `services/finding-analysis.ts` (set `owaspCategory` in `analyzeFinding`, additive), `queues/worker.ts` (persist + broadcast `owaspCategory`), `services/pdf.service.ts` (new "Coverage by OWASP API Top 10" section), `services/__tests__/finding-analysis.test.ts` (owaspCategory assertions).
- **Migration:** `20260729043328_owasp_category` (additive: `attack_logs.owaspCategory TEXT`; applied via `migrate deploy`, status clean).

## 2026-07-29 — T9b: OWASP category badges + coverage view (client)

The client half of OWASP API Top 10 mapping. Every finding now shows a compact
**OWASP category chip** (short code like `API8`, full 2023 label on hover) in the
FindingDetailPanel (shared by the live console + Report), on the Report finding
rows, and on the live-console rows; null/absent renders a muted **Unmapped** chip.
The Report gains a **"Coverage by OWASP API Top 10 (2023)"** section listing all
10 categories with a per-category finding count (0 where none) + Unmapped,
mirroring the PDF. The REST response already carries `owaspCategory` (getTestRun
recomputes findings via analyzeFinding, which sets it in T9a), so categories
survive reload — **no server change needed**. Light-mono styling; enum values +
labels mirror the server exactly.

- **Added:** `client/src/components/OwaspBadge.tsx` (shared chip), `client/src/test/owasp.test.ts` (coverage reducer + label helpers).
- **Changed:** `client/src/services/api.ts` (`OwaspApiCategory` type + `owaspCategory?` on `FindingDetail`; `OWASP_LABELS` / `OWASP_API_CATEGORIES`; `owaspShortCode` / `owaspLabel` / `owaspCoverage` helpers), `client/src/components/FindingDetailPanel.tsx` (OWASP chip in header), `client/src/pages/Report.tsx` (coverage section + row chips), `client/src/components/DashboardCommand.tsx` (OWASP chip on live rows).
- **Server:** none (REST already surfaced `owaspCategory`).
- **Migration:** none.
