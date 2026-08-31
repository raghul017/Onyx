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

## 2026-07-29 — T10a: API-token auth + token management UI

Users can mint long-lived **API tokens** to authenticate REST calls
non-interactively (for the T10b CLI / CI) and revoke them. Tokens are
`onyx_<43 base62 chars>` (~256 bits); only a **SHA-256 hash** is stored
(unique-indexed) and the plaintext is returned **exactly once** on creation
(never again, never logged). `authenticateToken` now treats an `onyx_`-prefixed
Bearer value as an API token (looked up by hash), sets the same `req.user`/`req.orgId`
context a JWT would, and bumps `lastUsedAt` (throttled ≤1×/min, non-blocking) — so
scoping, RBAC, and quota are identical; JWT auth is unchanged (fallthrough).
Revoked/unknown tokens → 401. Token-management endpoints are **session-only**
(a token can't mint/revoke tokens). CLI endpoints (`POST /test-runs`,
`GET /test-runs/:id`, `.../logs`, `.../export/pdf`) accept token auth automatically.

- **Added:** `server/src/services/api-token.service.ts` (+ test), `server/src/controllers/api-token.controller.ts` (+ test), `server/src/routes/api-token.routes.ts`, `server/src/middleware/__tests__/auth.test.ts`; `client/src/components/ApiTokensPanel.tsx`.
- **Changed:** `server/src/middleware/auth.ts` (async; API-token path + `requireSessionAuth` guard; `req.authMethod`), `types/express.d.ts` (`authMethod`), `validators/schemas.ts` (`createApiTokenSchema`), `routes/index.ts` (register), `schema.prisma` (`ApiToken` model); `client/src/services/api.ts` (token bindings), `client/src/pages/Settings.tsx` (render API tokens panel).
- **Header choice:** reuse `Authorization: Bearer <token>` (prefix-discriminated) — no new header, CLI-friendly.
- **Env:** none (SHA-256 of a 256-bit random token; no keyed-HMAC secret needed).
- **Migration:** `20260729093022_api_tokens` (additive: `api_tokens` table + unique `tokenHash` index + FKs; applied via `migrate deploy`, status clean).

## 2026-07-29 — T10b: Onyx CLI (`onyx scan`)

A standalone `cli/` package (Node ≥20, TypeScript, **zero runtime deps** — uses
built-in `fetch`) that runs a scan against the hosted Onyx API with a T10a API
token and gates CI on the result. `onyx scan --spec <public-openapi-url>` creates
a run (`POST /api/test-runs`), polls `GET /api/test-runs/:id` (backoff, `--timeout`)
until `COMPLETED`/`FAILED`, then renders **table** / **json** / **sarif** and sets
its exit code by `--fail-on`. Exit: **0** none ≥ threshold, **1** ≥ threshold,
**2** operational (401, unverified domain, run FAILED, timeout, network) with a
clear hint. SARIF 2.1.0: rule-per-category, `level` mapped from severity
(critical/high→error, medium→warning, low/info→note), locations = endpoint. Token
via `--api-token`/`ONYX_TOKEN`, base via `--api-url`/`ONYX_API_URL`; the token is
never logged. `DOMAIN_NOT_VERIFIED` surfaces a verify-the-domain hint. `INFO`
probes are counted but excluded from findings/results.

- **Added:** `cli/` package — `package.json` (`bin: onyx`), `tsconfig.json`, `README.md` (usage, exit-code table, GitHub Actions snippet), `src/` (index, args, client, scan, io, findings, errors, types, owasp, version, format/{table,json,sarif}), `test/` (args, fail-on, json, sarif, scan — 24 tests, mocked client/IO, no live network).
- **Changed:** docs/UPDATES.md.
- **Server/client:** untouched (the CLI is standalone; it mirrors the API types).
- **Migration:** none.

## 2026-07-29 — T11: GitHub Action + PR checks (wraps the T10b CLI)

A **composite** GitHub Action (`action.yml` at the repo root, referenced in-repo as
`uses: ./`) that runs an Onyx scan in CI, uploads SARIF to the **Security** tab,
posts/updates a **PR comment** with the finding summary, and fails the check per
`fail-on` — reporting **before** the failing exit. The scan runs **once** and emits
both reports via a new CLI flag `--sarif-out` (`--format json --out onyx.json
--sarif-out onyx.sarif`), so json (for the comment) and SARIF (for the Security tab)
come from a single scan — no double-charging. Steps: `setup-node@v4` (Node 20) →
build the CLI from `github.action_path/cli` (`npm ci && npm run build`, because the
CLI isn't on npm yet) → run the scan capturing the exit code (`set +e; node …; CODE=$?`)
without aborting → `codeql-action/upload-sarif@v3` (guarded by `hashFiles`,
`continue-on-error`) → `github-script@v7` PR comment on `pull_request` only, using a
hidden `<!-- onyx-scan -->` marker to find-and-update (no spam) → final step re-exits
with the captured code. Token passed via the `ONYX_TOKEN` env var + `::add-mask::`
(never on the command line or in logs). Optional `api-url`/`org`/`auth-recipe` flags
are added only when non-empty (an empty `--api-url` would break normalization).

Inputs: `spec` (req), `api-token` (req), `api-url`, `auth-recipe`, `org`, `fail-on`
(default `high`), `working-directory` (default `.`), `github-token` (default
`${{ github.token }}`). Required job permissions: `contents: read`,
`security-events: write`, `pull-requests: write`.

- **Added:** `action.yml` (repo root composite action); `action/onyx-comment.cjs` (pure `MARKER` + `findMarkerComment` + `buildCommentBody`, dep-free CommonJS for `github-script` `require()`); `action/test/onyx-comment.test.cjs` (`node:test`, mocked octokit list — 6 tests); `action/README.md` (inputs table, permissions, secrets, exit-code behavior, external-distribution follow-up); `.github/workflows/onyx-scan.yml` (example: `pull_request` + `workflow_dispatch`, permissions block, `uses: ./`).
- **Changed:** `cli/src/args.ts` (`--sarif-out` flag + `ScanOptions.sarifOut`), `cli/src/scan.ts` (write SARIF when `sarifOut` set, any `--format`), `cli/test/scan.test.ts` (dual-output single-scan test — 25 tests), `cli/README.md` (`--sarif-out` row + CI/CD integration pointer to the action); docs/UPDATES.md.
- **External distribution:** documented follow-up (npm-publish the CLI, or a dedicated `onyx-action` repo with versioned tags) — not in this ticket's scope.
- **Verification:** CI-only — GitHub Actions can't run locally. YAML parse validated; comment-logic + CLI tests green; CLI build confirmed. See the commit body / SUMMARY for manual PR-verification steps.
- **Migration:** none.

## 2026-07-29 — T21a: Navbar mega-menu + route stubs + mobile menu

First landing-redesign ticket (see docs/Onyx-Landing-Redesign.md). CLIENT-ONLY.
Rebuilt the marketing navbar's logged-out variant into a dropdown mega-menu —
**Product / Solutions / Resources** — while **preserving the exact bar styling**
(same height, `#fafafa`/85 blur, `#e6e6e6` hairline, logo, uppercase links, and
the black `mono-btn` "Start free scan" + "Sign In"). The only visual additions
are caret indicators on the three triggers and the dropdown panels themselves.
Dropdowns open on **hover and click/focus**, are keyboard-accessible (Esc closes
and restores focus, `focus-visible` rings, `aria-haspopup`/`aria-expanded`),
close on outside-click/tab-out, and are light-mono styled (white panel, hairline,
sharp corners, blue `#3b82f6` hover) with a short description under each item. The
**logged-in variant** (Dashboard/Billing/profile/sign-out + plan pill) is intact.

Every dropdown link resolves — no 404s. Homepage anchors use `/#anchor`; a new
`useHashScroll` hook scrolls to the target after arriving (incl. from another
route, which navigates home first). Forward anchors (`#authenticated`/`#owasp`/
`#cicd`/`#demo`) are wired now and simply no-op until their sections ship in
T21b/T21c. Added presentable lazy **route stubs** so nav links land somewhere
real: `/pricing` (reuses the extracted, real `PricingSection`), `/security`,
`/changelog`, `/privacy`, `/terms`, `/responsible-disclosure` — all on a shared
`MarketingPage` shell (Navbar + framed column + Footer). The homepage `#pricing`
anchor still works (same component); the nav Pricing now points at `/pricing`.

- **Added:** `client/src/components/nav-config.ts` (nav IA data), `client/src/hooks/useHashScroll.ts`, `client/src/components/MarketingPage.tsx`, `client/src/components/PricingSection.tsx` (extracted from Landing), `client/src/pages/Pricing.tsx`, `client/src/pages/Security.tsx`, `client/src/pages/Changelog.tsx`, `client/src/pages/Legal.tsx` (Privacy/Terms/ResponsibleDisclosure), `client/src/test/nav-config.test.ts`, `docs/Onyx-Landing-Redesign.md`.
- **Changed:** `client/src/components/Navbar.tsx` (mega-menu + collapsible mobile groups; bar styling preserved), `client/src/pages/Landing.tsx` (import extracted PricingSection; wire useHashScroll; removed the inline pricing block), `client/src/App.tsx` (6 new lazy public routes), `client/src/components/Footer.tsx` (Pricing → /pricing; added Security + Changelog); docs/UPDATES.md.
- **Tests:** `nav-config.test.ts` (3 tests) asserts every internal href is a known route or homepage anchor (no 404) — client suite 35/35 green; `npm run build` (tsc + vite) clean.
- **Schema/migration:** none. **Env:** none.
- **Deferred:** forward anchor sections (T21b/T21c); full Pricing page (T21d), Security page (T21e), Changelog from UPDATES.md (T21f), legal content (T21g). Footer route links are still plain `<a>` (full-reload) — full footer refresh is a later ticket.

## 2026-07-29 — T21b: Homepage — Authenticated scanning + OWASP coverage sections

Second landing-redesign ticket (docs/Onyx-Landing-Redesign.md). CLIENT-ONLY.
Added the two new homepage sections that the T21a Product dropdown anchors point
at, so `/#authenticated` and `/#owasp` now scroll to real content. Both mirror the
existing light-mono sections exactly (split/hairline-grid layout, `.mono-eyebrow`
+ `sq`, `text-[44px]` headline, `p-12 lg:p-24` rhythm, `.mono-card`, `#fafafa`/`#fff`
surfaces, `#e6e6e6` hairlines, single blue `#3b82f6` accent, no shadows) and use
the shared `enter` scroll-entrance motion. Inserted after HowItWorks, before
FeatureShowcase (positions 6 & 7). Both carry `scroll-mt-24` so the sticky navbar
doesn't overlap the target heading.

- **Authenticated scanning** (`#authenticated`): "Test what's behind the login."
  Split section with a four-tile "auth methods" grid (static tokens & API keys,
  OAuth2 & login flows with auto-refresh, encrypted-at-rest/never-logged,
  missing-auth probes). Code-generated visual — no screenshots.
- **OWASP API Top 10 coverage** (`#owasp`): "Every finding, named." A 10-cell
  API1–API10 grid using the **real 2023 titles** (matched to
  `server/src/services/owasp-mapping.ts`). HONESTY: only the codes the mapping
  actually emits today — **API2, API3, API4, API8** — are emphasized (accent
  left-rail + `#eff6ff` fill + "Detected" chip); the rest are muted with a
  "Mapped — expanding coverage" chip. A one-line legend explains the two states.
  No claim of full detection.

- **Added:** `client/src/components/AuthenticatedScanning.tsx`, `client/src/components/OwaspCoverage.tsx` (exports a pure `OWASP_CATEGORIES` array), `client/src/test/owasp-coverage.test.ts`.
- **Changed:** `client/src/pages/Landing.tsx` (import + render the two sections in order).
- **Tests:** `owasp-coverage.test.ts` (3 tests) asserts all 10 categories in order, exactly API2/3/4/8 flagged detected (no overclaim), and real titles — client suite 38/38 green; `npm run build` (tsc + vite) clean.
- **Schema/migration:** none. **Env:** none.
- **Deferred:** CI/CD shift-left + product-proof console sections (`#cicd`/`#demo`) land in T21c.

## 2026-07-29 — T21a-fix: show marketing dropdowns when logged in

Fix to the T21a marketing navbar. CLIENT-ONLY. Previously the Product/Solutions/
Resources dropdowns + Pricing rendered ONLY when logged out; logged-in visitors on
the marketing/landing pages saw a stripped variant (Docs/GitHub/Dashboard) with no
mega-menu. Refactored `Navbar.tsx` so the left/center nav (logo + the three
dropdowns + Pricing) renders in BOTH auth states; only the right-side action
cluster branches — logged-out shows Sign In + Start free scan (unchanged),
logged-in shows Dashboard / Billing / profile chip / sign-out (+ plan pill on the
logo, unchanged). The mobile menu likewise shows the collapsible groups + Pricing
in both states, with the correct auth actions at the bottom. The standalone
"Docs"/"GitHub" links from the old logged-in variant are dropped — both remain
reachable inside the Resources dropdown. Bar styling (height, colors, fonts, blur,
border) unchanged; removed a now-unused `GITHUB_URL` import.

Marketing `Navbar` renders on: `/` (Landing) and every `MarketingPage` route
(`/pricing`, `/security`, `/changelog`, `/privacy`, `/terms`,
`/responsible-disclosure`). The authed app header (`AppHeader.tsx`, used by
`/dashboard`, `/settings`, `/profile`, `/history`, `/report/:id`, `/billing`) is
untouched.

- **Changed:** `client/src/components/Navbar.tsx` (dropdowns render in both auth states; only right-side cluster branches; mobile mirrors; dropped unused GITHUB_URL import); docs/UPDATES.md.
- **Schema/migration:** none. **Env:** none. **Tests:** none new — client suite 38/38 green; `npm run build` (tsc + vite) clean.

## 2026-07-29 — T21c: Homepage — CI/CD shift-left section

Landing-redesign ticket (docs/Onyx-Landing-Redesign.md). CLIENT-ONLY. Added the
`#cicd` homepage section so the Product/Solutions dropdown anchors scroll to real
content advertising the shipped CLI (T10b) + GitHub Action (T11). Mirrors the
existing light-mono sections exactly (split/hairline-grid, `.mono-eyebrow` + `sq`,
`text-[44px]` headline, `p-12 lg:p-24` rhythm, `.mono-card` tiles, `#e6e6e6`
hairlines, single blue `#3b82f6` accent, shared `enter` scroll-motion, no shadows)
and carries `scroll-mt-24` under the sticky navbar. Inserted after OwaspCoverage,
before FeatureShowcase (position 8): HowItWorks → AuthenticatedScanning →
OwaspCoverage → CiCdSection → FeatureShowcase.

- Eyebrow SHIFT LEFT; headline "Break the build before attackers break in."
- Four tiles: one-line CLI (table/JSON/SARIF), GitHub Action with PR comments,
  SARIF → GitHub Security tab, exit-code gating for any CI.
- Two **light-mono** code blocks (JetBrains Mono on `#f5f5f5`, hairline border,
  `overflow-x-auto`, per-block copy button reusing the Docs pattern — NOT a dark
  terminal): the real CLI command
  `onyx scan --spec ./openapi.json --fail-on high --format sarif`, and a compact
  GitHub Action YAML snippet.

- **Added:** `client/src/components/CiCdSection.tsx`.
- **Changed:** `client/src/pages/Landing.tsx` (import + render CiCdSection in order).
- **Tests:** none new (no natural pure helper) — client suite 38/38 green; `npm run build` (tsc + vite) clean.
- **Schema/migration:** none. **Env:** none.
- **Note:** the Action snippet shows `uses: onyx/scan-action@v1` (intended external-distribution form); the T11 action is currently repo-local (`uses: ./`) with external distribution as a documented follow-up.
- **Deferred:** product-proof / live-console `#demo` section is the next ticket.

## 2026-07-29 — T21-demo: Homepage — product-proof live console replay section

Landing-redesign section 9 (docs/Onyx-Landing-Redesign.md). CLIENT-ONLY. Added the
`#demo` homepage section — "Watch it attack, live." — so that anchor scrolls to
real product proof. Inserted after CiCdSection, before FeatureShowcase: HowItWorks
→ AuthenticatedScanning → OwaspCoverage → CiCdSection → DemoSection →
FeatureShowcase. Carries `scroll-mt-24` under the sticky navbar.

Centerpiece is a NEW **light-mono** `LiveConsoleReplay` (the dark off-brand
ChaosStream was NOT resurrected): white `mono-card` panel, `#e6e6e6` hairlines,
JetBrains Mono, blue `#3b82f6` accent. Header shows "onyx // live" + a status dot
and a live finding count. Rows mirror the real console's AttackResult shape
(METHOD, path, status, latency ms, attack type, severity chip + OWASP code).
Auto-plays via IntersectionObserver (only animates when visible), streaming one
curated fixture row per ~320ms, auto-scrolling the list, then a "scan complete"
state that loops after a pause. `prefers-reduced-motion` → the full list renders
statically with no timers. The panel is `role="img"` with an aria-label summary
(decorative; no focus trap). Fixture is a realistic mix (confirmed findings across
CRITICAL/HIGH/MEDIUM/LOW + handled 2xx INFO probes), capped at 12 rows.

Below the replay: two intentional, captioned placeholder frames ("Product
walkthrough" / "Sample report") reserved for real media in the **T21-media** pass,
with the exact swap-in points marked in a code comment:
  • `client/public/demo-scan.mp4`     → `<video autoPlay muted loop playsInline>`
  • `client/public/report-sample.png` → `<img alt="Onyx sample report">`

- **Added:** `client/src/data/replayFixture.ts` (pure `REPLAY_ROWS`), `client/src/components/LiveConsoleReplay.tsx`, `client/src/components/DemoSection.tsx`, `client/src/test/replay-fixture.test.ts`.
- **Changed:** `client/src/pages/Landing.tsx` (import + render DemoSection in order).
- **Tests:** `replay-fixture.test.ts` (4 tests) guards row shape, OWASP codes, the findings/info mix, and the row cap — client suite 42/42 green; `npm run build` (tsc + vite) clean.
- **Schema/migration:** none. **Env:** none.
- **Deferred (T21-media):** swap the two placeholders for `client/public/demo-scan.mp4` + `client/public/report-sample.png`.

## 2026-07-29 — T21d: Full standalone Pricing page

Landing-redesign ticket (docs/Onyx-Landing-Redesign.md). CLIENT-ONLY. Turned the
T21a `/pricing` stub into a full page: hero → shared tier cards → quota/feature
comparison table → billing FAQ (accordion) → black CTA banner. Light-mono
throughout; billing logic, checkout, and the authed Billing page are untouched
(cards still link to `/billing`).

SOURCE OF TRUTH (verified from code, no invented numbers):
- Quotas — `server/src/middleware/quota.middleware.ts` `PLAN_LIMITS`:
  FREE 5 runs/mo · 10 endpoints/run; PRO 100 · 50; TEAM 500 · unlimited (999999);
  ENTERPRISE 999999/999999 — NOT sold via checkout, so no client tier (Free/Pro/Team only).
- Feature gates (server): PDF export is paid-only (`routes/index.ts`, FREE → 403
  `PLAN_REQUIRED` "PDF export is a Pro feature"); baseline capture is paid-only
  (`test-run.controller.ts`, `captureBaseline = plan !== "FREE"`).
- Prices/currency — `Billing.tsx` + `PricingSection`: $0 / $9 (₹900) / $18 (₹1800);
  "Priced in USD, billed in INR". Pro is the highlighted/recommended tier.
- Comparison rows reflect the above; runs/endpoints/PDF/baseline/multi-user/API/
  support marked per real enforcement; authenticated scanning, OWASP mapping, and
  live streaming shown as available on all tiers.

Extracted a shared `components/plans.ts` (single source of truth: `pricingPlans` +
`COMPARE_ROWS` + `PLAN_COLUMNS`) so the homepage `#pricing` section and `/pricing`
never drift. `PricingSection.tsx` now imports from it and re-exports `pricingPlans`
for existing importers (no visual change). Currency display logic unchanged.

- **Added:** `client/src/components/plans.ts`, `client/src/test/plans.test.ts`.
- **Changed:** `client/src/pages/Pricing.tsx` (stub → full page: comparison table + FAQ + CTA), `client/src/components/PricingSection.tsx` (consume shared `plans.ts`; re-export for compat); docs/UPDATES.md.
- **Tests:** `plans.test.ts` (6 tests) asserts tiers = Free/Pro/Team, prices, Pro highlighted, comparison quotas == server PLAN_LIMITS, PDF/baseline paid-only gates, 3 cells/row — client suite 48/48 green; `npm run build` (tsc + vite) clean.
- **Schema/migration:** none. **Env:** none.
- **Deferred:** per-page SEO/meta for `/pricing` lands in T21h; refund/cancellation copy points to Terms (T21g) rather than inventing policy.

## 2026-07-29 — T21e: Full Security / Trust page

Landing-redesign ticket (docs/Onyx-Landing-Redesign.md). CLIENT-ONLY. Turned the
T21a `/security` stub into a full light-mono page: intro → How we test safely →
How we protect your data → Account security → Infrastructure → Compliance →
Responsible disclosure. ACCURACY GUARDRAIL honored — every claim maps to a real
control read from the server code; no certification is claimed.

Controls described + source (all verified in code):
- **Domain-ownership verification** (file `/.well-known/onyx-verify.txt` OR DNS TXT
  `_onyx-verify.<domain>`) — `server/src/services/domain-verify.service.ts`.
- **SSRF guard** (DNS-resolves host; blocks loopback/private/link-local/CGNAT/
  cloud-metadata 169.254.169.254/IPv4-mapped IPv6/ULA/multicast; short-TTL re-vet
  for DNS rebinding) — `server/src/lib/ssrf-guard.ts`.
- **10s request timeout** (AbortController) — `server/src/queues/worker.ts`
  (`REQUEST_TIMEOUT_MS`).
- **Paced concurrency + rate limits + quotas** (worker concurrency 12, limiter
  3/100ms ≈ 30 req/s; auth 5/min/IP, test-runs 5/hr/IP; per-plan monthly quotas) —
  `queues/worker.ts`, `routes/auth.ts`, `routes/index.ts`, `middleware/quota.middleware.ts`.
- **AES-256-GCM** auth-recipe secret encryption at rest — `server/src/lib/crypto.ts`.
- **SHA-256 API-token hashing** (plaintext never stored; revocable) —
  `server/src/services/api-token.service.ts`, `controllers/api-token.controller.ts`.
- **Response redaction** (bearer/api-key/password → ***REDACTED*** before persist/
  broadcast) — `server/src/lib/redact.ts`.
- **JWT HS256** (algorithm pinned) — `server/src/middleware/auth.ts`; **bcrypt**
  (cost 12) + **Google/GitHub OAuth** — `server/src/controllers/auth.controller.ts`.
- **Infrastructure**: described at a truthful, non-sensitive level (managed
  PostgreSQL/Neon + Redis/BullMQ queue) — no versions/hostnames/topology leaked.
- **Compliance**: explicit forward-looking line — "Onyx is NOT SOC 2 or ISO 27001
  certified today"; no false or "in-progress audit" claim.
- **Responsible disclosure**: invites coordinated disclosure; links to
  `/responsible-disclosure` (T21g) + GitHub Issues (no security email exists yet;
  used GitHub as the contact channel).

- **Changed:** `client/src/pages/Security.tsx` (stub → full page); docs/UPDATES.md.
- **Tests:** none new — client build-verified (no pure helper); client suite 48/48 green; `npm run build` (tsc + vite) clean.
- **Schema/migration:** none. **Env:** none.
- **Deferred:** per-page SEO/meta for `/security` lands in T21h; a dedicated security email could replace the GitHub contact later.

## 2026-07-29 — T21f: User-facing Changelog page

Landing-redesign ticket (docs/Onyx-Landing-Redesign.md). CLIENT-ONLY. Turned the
T21a `/changelog` stub into a real changelog rendered from a NEW curated,
user-facing data source — NOT this file. Decision: `docs/UPDATES.md` is the
internal dev log (ticket IDs, file paths, test counts) and is never rendered
publicly; instead entries were rewritten into plain, benefit-oriented release
notes in `client/src/data/changelog.ts`.

> Note: user-facing release notes live in `client/src/data/changelog.ts`.
> `docs/UPDATES.md` stays the internal dev log — do not render it to users.

The page shows a light-mono vertical timeline of dated release blocks, each with a
New/Improved/Fixed tag chip and bullet items. Seeded from real ship history only
(no fabricated dates), grouped by the actual release dates:
- **Jul 29** — refreshed site & navigation (New); CLI + GitHub Action + API tokens
  (New); OWASP API Top 10 mapping (New).
- **Jul 28** — authenticated scanning incl. OAuth2 + login flows w/ auto-refresh and
  missing-auth probes (New); evidence-based detection via baselines + diffing (Improved).
- **Jul 13** — broader attack coverage (GET/DELETE + query/path/header params) (Improved);
  reliability & safety — structured logging, error tracking, redaction, migrations (Improved).

- **Added:** `client/src/data/changelog.ts` (curated public changelog), `client/src/test/changelog.test.ts`.
- **Changed:** `client/src/pages/Changelog.tsx` (stub → timeline rendering the curated data); docs/UPDATES.md.
- **Tests:** `changelog.test.ts` (3 tests) — entries well-formed, sorted newest-first, and a guard that no ticket IDs / file paths / test counts leak into the public copy. Client suite 51/51 green; `npm run build` (tsc + vite) clean.
- **Schema/migration:** none. **Env:** none.
- **Deferred:** per-page SEO/meta for `/changelog` lands in T21h.

## 2026-07-29 — T21g: Legal pages (Privacy, Terms, Responsible Disclosure)

Landing-redesign ticket (docs/Onyx-Landing-Redesign.md). CLIENT-ONLY. Turned the
T21a shared Legal stub into three DISTINCT, real long-form documents on a shared
light-mono prose shell (`LegalDoc`: max-w-[760px] column, semantic H2/H3/P/UL). The
three named exports (Privacy/Terms/ResponsibleDisclosure) are unchanged, so App.tsx
routing needs no edit. **DRAFTS, not legal advice** — a banner + bracketed
[PLACEHOLDERS] mark everything that needs an owner/lawyer to fill in.

Data-handling claims verified against real code (no overclaim):
- Stored: email, optional name, bcrypt passwordHash (null for OAuth), Google/GitHub
  OAuth identity, plan + Razorpay sub id/expiry, org membership; target spec URLs +
  endpoints; AttackLog (method/path/payload/status/latency + responseSnippet
  **redacted** and **capped at 500 chars** — `worker.ts`/`redact.ts`); AuthRecipe
  secret **AES-256-GCM encrypted** (`secretEnc`; meta = descriptors + last4);
  ApiToken **SHA-256 hash**; Razorpay WebhookEvent ids. Source: `schema.prisma`.
- Processors listed: Neon (Postgres), Upstash/Redis (queue), Render (API), Vercel
  (web + analytics/speed-insights), Razorpay (payments), Google/GitHub (OAuth),
  Google Gemini (payload generation).
- Terms includes a strong **authorization-first acceptable-use** section (scan only
  what you own / are authorized to test; domain-ownership verification enforced;
  prohibited: third-party scanning, DoS, circumventing controls) + billing via
  Razorpay ("cancel anytime, access until period end", no invented refund policy) +
  warranty disclaimer + liability limit + termination + governing law.
- Responsible Disclosure routes reporters to a **private** contact
  (`security@[your-domain]`), NOT public GitHub Issues; includes safe-harbor/good-
  faith terms, in/out scope, what to include, and expected response.

Footer: added a **Legal** column (Privacy / Terms / Responsible Disclosure) — the
footer previously had no legal links (nothing pointed at the stubs).

PLACEHOLDERS TO FILL (owner/lawyer): `[Legal Entity Name]`, `[Address]`,
`[Jurisdiction]` (+ venue/dispute clause), `[Effective Date]`, retention periods,
legal-basis/transfer-mechanism framing, liability-cap window, refund policy (if any),
disclosure response-time window.
MAILBOXES TO CREATE: `privacy@[your-domain]`, `legal@[your-domain]`,
`support@[your-domain]`, and **`security@[your-domain]`** (the private security
mailbox — this closes the T21e follow-up that had pointed disclosure at GitHub).

- **Changed:** `client/src/pages/Legal.tsx` (shared stub → three full documents on a `LegalDoc` shell), `client/src/components/Footer.tsx` (new Legal column); docs/UPDATES.md.
- **Tests:** none new — client build-verified; client suite 51/51 green; `npm run build` (tsc + vite) clean.
- **Schema/migration:** none. **Env:** none.
- **Deferred:** lawyer review before relying on these; create the mailboxes above; per-page SEO/meta for the legal routes lands in T21h.

## 2026-07-29 — T21h: Per-route SEO meta + prerender + sitemap

Landing-redesign ticket (docs/Onyx-Landing-Redesign.md). CLIENT-ONLY. Every public
route now emits unique title/description/canonical/OG/Twitter meta, and the public
routes are PRERENDERED to static HTML at build time so crawlers and social scrapers
(which don't run JS) get real content + correct meta. The SPA still loads and takes
over on top.

- **Per-route meta:** added `react-helmet-async` (`HelmetProvider` at the app root)
  and a reusable `<Seo>` component (title/description/canonical/og:*/twitter:*).
  All per-route metadata lives in ONE source, `client/src/lib/seo.ts` →
  `PUBLIC_ROUTES` + the `SITE_URL` constant.
- **SITE_URL:** `https://onyx-engine.vercel.app`, defined once in
  `client/src/lib/seo.ts`. **To move to a custom domain, change SITE_URL there** —
  canonical, og:url, and sitemap.xml all derive from it. (Also update the two
  default tags in `client/index.html` + the Sitemap line in `public/robots.txt`.)
- **Prerender approach:** a postbuild Node script (`scripts/prerender.mjs`) uses
  Vite's own SSR pipeline (`createServer` + `ssrLoadModule`) to render each public
  route via `src/entry-prerender.tsx` (`renderToString` + `StaticRouter` + helmet),
  then bakes the markup + per-route head tags into `dist/<route>/index.html`. Chosen
  over vite-plugin-prerender (unmaintained) / react-snap (needs Chromium, React-17
  era) because it needs no browser, no Chromium, and no router rewrite, and reuses
  the project's aliases/plugins. Wired as `build = vite build && npm run prerender`.
- **WebGL guard:** the three.js components (ShaderHeroBG, DotGlobe) init inside
  `useEffect`, which does NOT fire during `renderToString` — so prerender renders
  their CSS fallbacks and never touches WebGL/canvas. No crash. (Public pages are
  imported STATICALLY in the prerender entry, not React.lazy, because renderToString
  doesn't resolve Suspense — a lazy tree would bake the loading spinner instead of
  the page.)
- **sitemap.xml** emitted to `dist/` for all 10 public routes; `robots.txt` now has
  a `Sitemap:` line; the commented canonical/og:url in `index.html` are set to
  SITE_URL defaults (per-route helmet overrides them at prerender).
- **Vercel:** `vercel.json` gains `cleanUrls: true` so Vercel serves the prerendered
  `dist/<route>/index.html` for each public path (filesystem match wins); the SPA
  rewrite only catches paths with no prerendered file (i.e. authed routes). Authed
  routes are NEVER prerendered.

Prerendered routes: /, /pricing, /security, /changelog, /privacy, /terms,
/responsible-disclosure, /docs, /signin, /signup.

VERIFIED in the built output (raw HTML, pre-JS): each route has its own
`<title>`, single `canonical`/`og:url`/`description` (no dupes), absolute
`og:image`, and real page copy (e.g. /pricing → "Plans that scale…"/"transparent
pricing"; /security → "Security is the product"/"SSRF guard"; home → hero copy). No
"Loading" fallback in output. App still references the JS entry → hydrates/loads and
stays interactive; WebGL works in a real browser. No `dist/dashboard/` etc.

- **Added:** `client/src/lib/seo.ts`, `client/src/components/Seo.tsx`, `client/src/entry-prerender.tsx`, `client/scripts/prerender.mjs`.
- **Changed:** `client/src/App.tsx` (HelmetProvider + AppProviders/AppRoutes split + per-route `<Seo>`), `client/index.html` (default canonical/og:url), `client/public/robots.txt` (Sitemap line), `client/vercel.json` (cleanUrls), `client/package.json` (+`react-helmet-async`, build runs prerender); docs/UPDATES.md.
- **Tests:** none new — build/output-verified; client suite 51/51 green; `npm run build` clean and prerenders 10/10 routes.
- **Schema/migration:** none. **New env:** none (SITE_URL is a code constant, not an env var).
- **Deferred/notes:** the app uses `createRoot` (client-render over the prerendered HTML), not `hydrateRoot` — safe and non-breaking (no mismatch errors), and crawlers already get the baked HTML; switching to true hydration is a possible future optimization. Custom-domain switch = change `SITE_URL` (+ the two index.html defaults + robots Sitemap line).

## 2026-07-30 — T21i (Part A): Font config + TypeScript cleanup

Landing-redesign hygiene ticket (docs/Onyx-Landing-Redesign.md). CLIENT-ONLY.
Part A safe fixes only — **no files deleted** (dead-file list is in the commit /
summary, pending owner approval).

- **Font config aligned with reality:** `tailwind.config.ts` declared `sans: Inter`
  but the CSS actually renders **Geist** (sans) + **JetBrains Mono** (mono).
  Updated `fontFamily` to `sans: [Geist, …]` / `mono: [JetBrains Mono, …]`, and
  removed the two unused webfont `@import`s from `index.css` — **Satoshi**
  (never referenced by any font-family) and **Inter** (no longer mapped by
  `font-sans`; Geist renders everywhere). No visual change — Geist already renders.
- **TypeScript: `tsc --noEmit` now fully clean (0 errors, was 23 pre-existing).**
  - Hero.tsx (4): typed the `rise` variant as `Variants` and made the cubic-bezier
    `ease` an `as const` tuple (framer-motion `Easing` widening). No behavior change.
  - SignIn.tsx / SignUp.tsx (8): same fix — `heroContainer`/`heroChild` typed as
    `Variants` (from `motion/react`) + `as const` ease.
  - Docs.tsx (10): the sidebar `NAV_GROUPS` used `as const`, so `flatMap(g => g.items)`
    produced a union of readonly tuples and every `.id`/`.label` degraded to `unknown`.
    Added `DocNavItem`/`DocNavGroup` types + annotated `NAV_GROUPS` (dropped `as const`).

Verify: `npm run build` clean (+ prerender 10/10); `tsc --noEmit` 0 errors; `npm test`
51/51 green.

- **Changed:** `client/tailwind.config.ts` (sans→Geist, mono→JetBrains), `client/src/index.css` (removed Satoshi + Inter imports), `client/src/components/Hero.tsx`, `client/src/pages/SignIn.tsx`, `client/src/pages/SignUp.tsx`, `client/src/pages/Docs.tsx` (type fixes); docs/UPDATES.md.
- **Schema/migration:** none. **Env:** none. **Tests:** none new.

### Part B — DELETION CANDIDATES (identified, NOT deleted — awaiting approval)
Proven unused (0 importers/references):
- `client/src/components/SupportedTech.tsx` — dark legacy, superseded by HowItWorks.
- `client/src/components/MetricsRow.tsx` — dark legacy dashboard widget, unused.
- `client/src/components/Pipeline.tsx` — dark legacy, superseded by HowItWorks.
- `client/src/components/ChaosStream.tsx` — dark, superseded by LiveConsoleReplay (T21-demo).
- `client/src/data/mockChaosData.ts` — only referenced by ChaosStream (dead pair).
- `client/src/components/HeroTerminal.tsx` — dark legacy hero, unused (also the only user of `public/hero-bg.png`).
- `client/src/components/ShaderBackground.tsx` — 0 references (superseded by ShaderHeroBG).
- `client/src/components/NavLink.tsx` — 0 references.
- `landing-page.html` (repo root) — orphaned; not a Vite entry, not referenced (the only "match" is a comment in FeatureShowcase.tsx).
- `client/src/pages/LandingPage/` (FAQFooter, FeatureGrid, Hero, Navbar, TechStack) — 0 importers; self-contained dead cluster.
- `client/public/lottie/*.json` (analytics, meter, reporting, scanning, search) — no `/lottie/` references in src; deps `lottie-react` + `@lottiefiles/react-lottie-player` are also unimported and could be removed from package.json.
- `client/public/hero-bg.png` — only used by HeroTerminal (dead); dies with it.

KEEP (still referenced — do NOT delete): `ShaderHeroBG.tsx` and `DotGlobe.tsx` are
**lazy-imported** (`lazy(() => import(...))`) by Hero/SignIn/SignUp and HowItWorks —
a naive grep misses these; they are live WebGL components.

## 2026-07-30 — T21i (Part B): Remove dead components + unused lottie deps

Executed the approved deletions from T21i Part A (all proven 0-reference). Verified
after removal: `tsc --noEmit` 0 errors, `npm run build` clean (+ prerender 10/10),
`npm test` 51/51, and no stale imports remain.

- **Deleted files:** `client/src/components/{SupportedTech,MetricsRow,Pipeline,ChaosStream,HeroTerminal,ShaderBackground,NavLink}.tsx`, `client/src/data/mockChaosData.ts`, `landing-page.html` (repo root), `client/public/hero-bg.png`.
- **Deleted dirs:** `client/src/pages/LandingPage/` (FAQFooter, FeatureGrid, Hero, Navbar, TechStack), `client/public/lottie/` (5 JSON files).
- **Deps removed:** `lottie-react`, `@lottiefiles/react-lottie-player` (package.json + package-lock.json updated); also dropped the now-empty `vendor-lottie` manualChunk from `client/vite.config.ts` (it still listed the removed packages and would have failed the build).
- **KEPT (lazy-imported, live):** `client/src/components/ShaderHeroBG.tsx`, `client/src/components/DotGlobe.tsx`.
- **Note:** `client/src/hooks/useChaosStream.ts` is a **separate live WebSocket hook** (not the deleted ChaosStream component) — it imports none of the deleted files and was not on the deletion list, so it was left untouched.
- **Changed:** `client/package.json`, `client/package-lock.json` (deps), `client/vite.config.ts` (removed vendor-lottie chunk); docs/UPDATES.md.

## 2026-07-30 — T12a: Multi-identity foundation (RunIdentity + per-identity credential resolution)

Phase 6 backend prerequisite for BOLA (T13). **SCOPE REFINEMENT:** foundation only —
NO attack fan-out across identities (that would multiply scan volume/cost). The
normal scan (baseline + attacks) runs under ONE PRIMARY identity exactly as today;
additional identities are stored, ownership-validated, and their credentials made
resolvable per-identity, ready for T13's targeted cross-identity replays. Fully
backward compatible; UI is T12b (no client work here).

- **Schema (additive migration `20260730100541_t12_run_identity`, applied via
  `migrate deploy` — purely additive: new table + 2 nullable columns + indexes +
  FKs, no drops/data loss; `migrate status` → "up to date"):**
  - New `RunIdentity { id, testRunId, authRecipeId?, label, isPrimary, createdAt }`,
    unique `(testRunId, label)`, FK testRun (cascade) + authRecipe (set null).
  - `identityId String?` added to `AttackLog` (indexed) and `BaselineResponse`, FK
    to RunIdentity (set null).
  - **`TestRun.authRecipeId` retained as the PRIMARY identity's recipe** — the
    scan path (worker/resolver) is unchanged; RunIdentity rows are additive. This
    was the cleaner, lower-risk choice than moving the recipe onto the primary row.
- **Run creation (`POST /api/test-runs`):** optional `identities: [{ label,
  authRecipeId?, isPrimary? }]` (max 4, unique labels, ≤1 primary). Every identity
  recipe is ownership-checked (same rule as the single-recipe path); rows persisted
  in the run-create transaction. Legacy `authRecipeId` → single primary identity;
  neither → single anonymous primary — today's behavior byte-for-byte.
- **Pipeline attribution:** the worker reads the primary identity id and tags every
  scan-created `AttackLog` and `BaselineResponse` with it. Job cardinality is
  unchanged — NO per-identity fan-out. Completion gate untouched.
- **Per-identity credential resolution:** new `IdentityCredentialResolver` (thin
  layer over the T8a `CredentialResolver`) resolves the credential for ANY identity
  by `identityId → authRecipeId → resolve(runId, recipeId)`; anonymous → no
  credential without hitting the loader. Reuses the shared resolver's cache /
  single-flight / no-plaintext-in-Redis guarantees. This is what T13 will call.

- **Added:** `server/src/services/run-identities.ts` (pure normalize/primary helpers), `server/src/services/identity-credential-resolver.ts` (per-identity resolution), `server/src/services/__tests__/run-identities.test.ts`, `server/src/services/__tests__/identity-credential-resolver.test.ts`, `server/prisma/migrations/20260730100541_t12_run_identity/`.
- **Changed:** `server/prisma/schema.prisma` (RunIdentity + identityId), `server/src/validators/schemas.ts` (identities[] validation + MAX_RUN_IDENTITIES), `server/src/controllers/test-run.controller.ts` (normalize + validate + persist identities; authRecipeId = primary), `server/src/queues/worker.ts` (read primary identity; attribute AttackLog + BaselineResponse); docs/UPDATES.md.
- **Tests:** 219 pass (17 files; +2 new — 10 T12 cases). Covers: multi-identity persistence shape, ownership/cap/unique/single-primary validation, primary selection, per-identity resolution incl. anonymous→no-cred and shared-cache, and backward-compat (legacy/anonymous unchanged). `npm run build`/tsc clean.
- **Backward compatibility:** legacy single-recipe and anonymous runs produce identical behavior with a single primary RunIdentity; completion gate unaffected; existing 209 tests still green.
- **Execution deferred to T13:** cross-identity (BOLA) replays that actually fire as secondary identities. **T12b:** UI to attach 2+ identities.

## 2026-08-31 — T13a: BOLA machinery — object-id detection, id acquisition, replay jobs

Phase 6. **MACHINERY ONLY** — no BOLA verdict/finding is emitted here; T13b judges
the raw A-vs-B results this ticket records. Builds on T12a (RunIdentity, identityId
on AttackLog, IdentityCredentialResolver). Backend-only.

When a run has >=2 identities, Onyx now: (1) finds GET-by-id DETAIL endpoints and
pairs them with their COLLECTION endpoint; (2) as the PRIMARY identity A, acquires
a real object id (from the collection JSON, else the spec example); (3) enqueues
"replay" jobs that re-request each detail endpoint with A's id AS each secondary
identity B; (4) the worker fires the replay AS B and AS A (owner baseline for that
id) and records both as AttackLogs (attackType BOLA_REPLAY) tagged by identity —
so T13b can group by (endpointId, bolaObjectId) and diff A vs B. If preconditions
aren't met (<2 identities, no detail endpoints, no acquired ids, or an anonymous
primary), NO replay jobs are enqueued and a normal scan is byte-for-byte unchanged.

- **Pure intelligence** (`object-id.ts`): id-param detection (path names id/*Id/
  *_id/uuid or integer/uuid types; last-in-path wins) + collection/detail pairing.
  `id-acquisition.ts`: JSON id extraction (arrays + data/items/results envelopes)
  + spec-example fallback + acquire orchestration. `bola-planner.ts`: plans B-vs-A
  replay specs, bounded by MAX_REPLAY_JOBS (60), skips cleanly. All unit-tested.
- **Orchestration** (`bola-orchestrator.ts` + `bola-fetcher.ts`): controller runs
  it AFTER the primary scan enqueues; the fetcher fires the collection GET as A
  (SSRF-guarded, 10s timeout, credential via IdentityCredentialResolver). Extracted
  `recipe-credential-loader.ts` from worker.ts so acquisition-as-A and replay-as-B
  resolve credentials exactly like the scan (no logic duplicated).
- **Job kind "replay"** (`attackJobDataSchema` + producer `enqueueReplayJobs`,
  priority 3 < attacks). Worker `processReplayJob`: injects A's objectId into the
  detail path, fires as B then A, records two AttackLogs (BOLA_REPLAY, identityId =
  firer, bolaSourceIdentityId = A, bolaObjectId = id), redacted + SSRF-guarded +
  timed. NO finding.
- **Completion gate**: `totalReplays`/`completedReplays` tracked separately (like
  baselines); `isRunComplete` waits for replays too; attack progress unaffected;
  missing counts default 0/0 so pre-T13/normal runs are unchanged.

- **Schema (additive migration `20260831054540_t13a_bola_replay`, applied via
  migrate deploy; migrate status clean):** AttackLog `bolaObjectId`/
  `bolaSourceIdentityId` (nullable); TestRun `totalReplays`/`completedReplays`
  (Int default 0). No drops/data loss. Job-kind string needs no migration.
- **Added:** `server/src/services/object-id.ts`, `id-acquisition.ts`, `bola-planner.ts`, `bola-orchestrator.ts`, `bola-fetcher.ts`, `recipe-credential-loader.ts` + 4 test files (`object-id`, `id-acquisition`, `bola-planner`, `bola-orchestrator`); migration dir.
- **Changed:** `prisma/schema.prisma` (replay columns/counters), `src/validators/schemas.ts` (kind "replay" + replay fields), `src/queues/producer.ts` (enqueueReplayJobs), `src/queues/worker.ts` (replay branch + processReplayJob + identity resolver wiring; loadRecipeCredential moved out), `src/services/run-completion.ts` (+replay counts), `src/controllers/test-run.controller.ts` (orchestrate replays after scan enqueue), `src/services/__tests__/run-completion.test.ts` (+replay cases); docs/UPDATES.md.
- **Tests:** 255 pass (21 files; +~30 T13a cases). `npm run build`/tsc clean.
- **Deferred to T13b:** the BOLA verdict — comparing each (A row, B row) pair to decide whether B accessed A's data, and emitting the finding.

## 2026-08-31 — T13b: BOLA verdict + persisted API1 finding

Phase 6. Completes BOLA **end-to-end at the engine level**: T13a produced the raw
A-vs-B replay results; T13b judges them and emits a real OWASP **API1** finding.
Backend-only. (Configuring 2+ identities is still API-only — the UI ticket is next.)

- **Verdict** (`bola-verdict.ts`, conservative — no false positives). Deterministic
  gates run FIRST and only ever reduce noise: B not 2xx → SAFE (access denied);
  B 2xx but empty/error-shaped body → SAFE; A itself couldn't read the object →
  SAFE (no ground truth); B's body clearly DIFFERS from A's → SAFE (API scoped B to
  its own data); B's body substantially MATCHES A's → candidate. Matching combines
  exact-body equality, shared identifying field values (id/_id/uuid + ≥2 fields),
  and token similarity (≥0.85 strong).
- **LLM interpretation** (`bola-judge.ts`, Gemini 2.5 Flash, JSON mode, temp 0 —
  reuses the ai-payload client pattern). It is asked one focused yes/no and can only
  **confirm or veto** a candidate — it never raises a finding alone. Strong match +
  judge agrees → `confidence: "confirmed"` (CRITICAL); judge unavailable/errors/
  unparseable → deterministic fallback at `confidence: "firm"` (HIGH). A judge
  "no" vetoes the finding. The LLM can never crash or block the pipeline. Only
  REDACTED, size-capped (2000 char) bodies are sent — no credentials/tokens/URLs.
- **Finding**: category "Broken Object Level Authorization", `owaspCategory:
  API1_BOLA`, evidence showing **BOTH** requests side-by-side with statuses +
  similarity/shared fields, a plain-English cause ("User B [bLabel] requested user
  A's [aLabel] object {id} and received A's data…"), and concrete remediation.
- **Persistence**: new nullable `AttackLog.findingJson Json?` (migration
  `20260831061359_t13b_finding_json`, applied via migrate deploy; status clean).
  A BOLA verdict needs BOTH identities' responses — which only exist together
  inside the replay job — so it's computed once there and stored, with
  `owaspCategory` set to API1_BOLA on B's row, plus a live `ATTACK_RESULT` broadcast.
- **Read path**: new `resolveFinding()` prefers a well-formed stored finding and
  otherwise recomputes via `analyzeFinding` exactly as before. Wired into
  `getTestRun`, `getTestRunLogs`, and the PDF (severity + OWASP coverage), so a
  confirmed BOLA surfaces on the report and **lights up API1** in coverage.
- **Scoring**: `computeScore` uses the stored severity for rows that have one
  (BOLA) and is unchanged for every other row; `scoreAndPersistRun` + the history
  list now select `findingJson`. A confirmed CRITICAL BOLA deducts 25 points.

- **Added:** `server/src/services/bola-verdict.ts`, `bola-judge.ts`; tests `bola-verdict.test.ts`, `resolve-finding.test.ts`; migration `20260831061359_t13b_finding_json/`.
- **Changed:** `prisma/schema.prisma` (findingJson), `src/queues/worker.ts` (verdict in processReplayJob: A row, B row + findingJson/API1, WS broadcast), `src/services/finding-analysis.ts` (+resolveFinding), `src/services/run-score.ts` (stored severity), `src/services/pdf.service.ts` (resolveFinding for severity + coverage), `src/controllers/test-run.controller.ts` (both read paths + score select), `src/services/__tests__/run-score.test.ts` (select assertion); docs/UPDATES.md.
- **Tests:** 277 pass (23 files; +22 T13b cases) — vulnerable→CONFIRMED, secure (403/404/empty/error-shaped), B-gets-own-data, judge veto, judge missing/throwing/null→firm fallback, stored-vs-recomputed read path, BOLA scoring. `npm run build`/tsc clean.
- **Verification note:** a real end-to-end BOLA needs 2 identities configured, which is only possible via the API until the UI ticket — so T13b is verified via fixtures/unit tests, not a live 2-identity scan.
- **Next:** UI to configure identities + surface BOLA findings.

## 2026-08-31 — T13c: Multi-identity scan UI + BOLA finding display

CLIENT-ONLY. Closes the BOLA loop: users can now attach 2–4 labeled identities to
a scan (which enables the T13a/b cross-identity engine), and confirmed BOLA
findings render clearly. Backend untouched.

- **Identities on the scan form** (`Dashboard.tsx`): a new "Identities" toggle in
  the scan toolbar (shown once at least one auth recipe exists) opens a compact
  light-mono panel. The **PRIMARY** identity keeps using the existing toolbar
  credential dropdown — so a single-identity scan is byte-for-byte the pre-T13c
  flow — and the panel adds secondary rows (label + credential picker, or
  "Anonymous (no auth)"), each removable, capped at 4 (server MAX_RUN_IDENTITIES).
  Labels are validated client-side against the server rules (non-empty, unique).
- **Payload** (`lib/identities.ts`, pure + tested): ONE identity → the legacy
  `authRecipeId` (or nothing when anonymous), NO `identities` array; 2+ → the
  `identities` array matching `server/src/validators/schemas.ts` exactly —
  `{ label, authRecipeId?, isPrimary? }`, trimmed labels, exactly one primary, and
  anonymous rows **omit** `authRecipeId` entirely (never null). `createTestRun`
  gained an optional third arg and only sends `identities` when length > 1.
- **BOLA hint**: shown only when a **credentialed primary** plus at least one other
  identity make cross-user testing possible — "BOLA testing enabled — Onyx will
  check whether one user can access another user's data." No hint for 1 identity or
  an anonymous primary (A must own objects).
- **BOLA finding display** (`FindingDetailPanel.tsx`): the panel already rendered
  cause/remediation/evidence + the OWASP badge, and evidence was already
  `whitespace-pre-wrap` monospace — so the A/B evidence read correctly. Added two
  minimal touches: a subtle **"Cross-user"** tag beside the API1 badge, and a
  full-width, taller evidence block ("Evidence — both requests") for API1_BOLA
  findings so both requests fit without cramping. Everything else unchanged.

- **Added:** `client/src/lib/identities.ts`, `client/src/test/identities.test.ts`.
- **Changed:** `client/src/pages/Dashboard.tsx` (identities state + toggle + panel + payload), `client/src/services/api.ts` (createTestRun identities arg + RunIdentityInput type), `client/src/components/FindingDetailPanel.tsx` (cross-user tag + wide evidence); docs/UPDATES.md.
- **Tests:** client 64 pass (9 files; +13 T13c) — backward-compat single-identity payload, multi-identity shape, anonymous omits authRecipeId, cap/trim, primary defaulting, BOLA-hint conditions, label validation. `npm run build` clean (prerender 10/10).
- **Schema/migration:** none. **Env:** none. **Backend:** untouched.

## 2026-08-31 — T-fix1: time-based injection on timeout

Backend-only detection fix. A sleep payload can outrun the 10s request timeout
(e.g. `SLEEP(20)`): the request is aborted, so the worker records `latencyMs 0`
and the T6 latency-delta rule structurally cannot see it — Onyx missed the
finding. A timeout on a DELAY payload, when the endpoint's benign baseline
answered fast, is strong evidence of time-based injection.

- **Worker** (`worker.ts`): `classifyNetworkError` now also returns a distinct
  `timedOut` boolean — true ONLY for the `REQUEST_TIMEOUT_MS` abort, false for
  ECONNREFUSED / DNS / other transport errors (which already mapped to 503/502/0).
  The attack-path catch records it and passes `timedOut` into `analyzeFinding`
  alongside the existing baseline. No other behavior changed.
- **finding-analysis** (`finding-analysis.ts`): one new rule in the baseline-aware
  layer, placed just before the existing latency-delta rule and reusing the SAME
  `TIME_INJECTION_PAYLOAD` matcher (SLEEP / WAITFOR DELAY / pg_sleep / BENCHMARK /
  DBMS_LOCK.SLEEP / delay marker). Fires only when ALL hold: `timedOut === true`
  **and** the payload matches the delay pattern **and** a baseline exists **and**
  the baseline was fast (`latencyMs < TIMEOUT_BASELINE_FAST_MS = 2000`) **and**
  the base verdict isn't already a confirmed disclosure. Emits category
  "Blind/Time-Based Injection", severity CRITICAL for `*INJECTION*`/SQLi else HIGH,
  confidence **"firm"** (one step below the measured-delta rule's "confirmed",
  since the response was never observed), owasp `API8_SECURITY_MISCONFIGURATION`,
  evidence "delay payload timed out (>10000ms); baseline responded in {n}ms —
  consistent with time-based injection."
- **Unchanged:** non-timeout paths, the T6 latency-delta rule, the Request Error /
  transport verdicts (a timeout with a non-delay payload still reads exactly as
  today), scoring shape, every other finding.

- **Changed:** `server/src/queues/worker.ts` (timedOut flag + threaded into analyzeFinding), `server/src/services/finding-analysis.ts` (`FindingInput.timedOut`, `TIMEOUT_BASELINE_FAST_MS`, the new rule), `server/src/services/__tests__/finding-analysis.test.ts` (appended only — 103 insertions, 0 deletions); docs/UPDATES.md.
- **Tests:** 286 pass (23 files; +9) — timeout+sleep+fast baseline → CRITICAL/firm (and HIGH for non-SQLi), the other delay dialects, plus the conservative fallbacks: non-delay payload, no baseline, slow baseline, null baseline latency, non-timeout transport error, and `timedOut` omitted. `npm run build`/tsc clean.
- **Schema/migration:** none. **Env:** none.

## 2026-08-31 — T14a: BFLA detection (API5)

Backend-only. Adds Broken Function Level Authorization detection on top of the
T12a/T13a multi-identity + replay machinery: with 2+ identities, the primary A is
the higher-privilege context and each credentialed secondary B is probed against
privileged endpoints. If B succeeds where it should be denied, that's a confirmed
**OWASP API5** finding.

- **Privileged-endpoint heuristic** (`privileged-endpoint.ts`, pure + tested).
  Conservative, documented signals — ANY one suffices: an administrative PATH
  SEGMENT (`/admin`, `/internal`, `/manage`, `/config`, `/settings`, `/roles`,
  `/permissions`, `/audit`, `/system`, … matched WHOLE-SEGMENT so `/badminton` and
  `/configurator` can't match); a WRITE (POST/PUT/PATCH/DELETE) on an
  account-administration collection (`/users`, `/accounts`, `/members`, `/orgs`,
  …) — reading those is common, mutating them is not; or an operationId naming an
  administrative action (`deleteUser`, `impersonate`, `grantRole`, …). A plain GET
  on an ordinary resource is never flagged.
- **Planner** (`bfla-planner.ts`, pure): one probe per (privileged endpoint ×
  credentialed secondary), reusing `MAX_REPLAY_JOBS`. Anonymous secondaries are
  deliberately excluded — "no auth reaches an admin route" is the MISSING_AUTH
  attack's job, and including it would double-report. Skips cleanly for <2
  identities / no primary / no credentialed secondary / no privileged endpoints.
- **Job model:** reused the existing `"replay"` job kind with a new
  `checkType: "bola" | "bfla"` discriminator (defaulting to `"bola"`, so every
  T13a job is unchanged) rather than adding a new kind. This means BFLA rides the
  **existing replay counters** (`totalReplays`/`completedReplays`) and completion
  gate — **no migration**.
- **Worker** (`processBflaProbe`): fires the privileged endpoint AS B with
  schema-valid dummy params and B's credential, plus A's result on the same
  endpoint for context. Same SSRF guard, 10s timeout, credential-scrub + T3
  redaction as the BOLA path.
- **Verdict** (`bfla-verdict.ts`): B not 2xx → SAFE; endpoint not privileged →
  SAFE; A also 404/501 (function absent) → SAFE; B 2xx on a privileged function →
  finding. Severity HIGH, **CRITICAL for destructive methods** (DELETE);
  confidence "confirmed" when the optional judge corroborates, else "firm". The
  LLM may only **VETO** — never raise a finding alone — and its absence/failure
  leaves the deterministic verdict standing (mirrors BOLA).
- **Persistence/surfacing:** the finding is stored in `findingJson` on B's row with
  `owaspCategory: API5_BFLA` and broadcast as `ATTACK_RESULT`. It flows through the
  existing T13b `resolveFinding` read path, scoring, and PDF, so **API5 lights up in
  OWASP coverage** with no extra work.
- **BUG FIXED (pre-existing, blocking):** `BOLA_REPLAY` was missing from the job
  `attackTypeEnum`, so **every T13a replay job failed the worker's `safeParse` and
  was dropped before reaching the replay branch — BOLA never actually ran.** Added
  `BOLA_REPLAY` + `BFLA_PROBE` to the enum and locked it with a regression test.

- **Added:** `server/src/services/privileged-endpoint.ts`, `bfla-planner.ts`, `bfla-verdict.ts`; tests `privileged-endpoint.test.ts`, `bfla-planner.test.ts`, `bfla-verdict.test.ts`, `server/src/validators/__tests__/replay-job.test.ts`.
- **Changed:** `validators/schemas.ts` (checkType + privilegedReason + the enum fix), `queues/producer.ts` (ReplayJobSpec checkType/privilegedReason; BFLA_PROBE attackType; checkType-aware jobId), `queues/worker.ts` (route checkType → new `processBflaProbe`), `services/bola-orchestrator.ts` (plan + enqueue BFLA alongside BOLA, one combined totalReplays), `controllers/test-run.controller.ts` (pass operationId + requestBodySchema to the orchestrator); docs/UPDATES.md.
- **Schema/migration:** **none** — reuses `findingJson`, the replay counters, and existing columns. `prisma migrate status` → "Database schema is up to date!".
- **Tests:** 317 pass (27 files; +31) — heuristic positives/negatives incl. substring guards, verdict (vulnerable/denied/non-privileged/absent/veto/judge-failure), planner fan-out + cap + all skip paths, and the job-validation regression. `npm run build`/tsc clean.
- **Verification note:** end-to-end BFLA needs 2 identities configured against a real API, so verification here is via fixtures/unit tests.

## 2026-08-31 — T14b: Mass Assignment (API3)

Backend-only. Detects mass assignment / Broken Object Property Level
Authorization: a client setting object properties it shouldn't by adding extra
fields to a write request. Single-identity — runs under the run's PRIMARY
identity (authed or anonymous) as part of the normal scan.

- **Check placement:** implemented as an ordinary **`kind: "attack"` job with
  `attackType: "MASS_ASSIGNMENT"`**, not a new job kind. It therefore rides the
  existing attack counters + completion gate, fires under the primary identity
  like every other attack, and needs **no new counters and no migration**. The
  job's `payload` IS the merged JSON body — `buildAttackRequest` already sends a
  JSON-like payload as the body verbatim, so no request-builder change was needed.
- **Curated privileged-field list** (`mass-assignment.ts`, documented + tight):
  privilege/authorization (`role`, `roles`, `isAdmin`, `is_admin`, `admin`,
  `permissions`, `scope`, `scopes`), account state that gates access
  (`isVerified`, `verified`, `isActive`), commercial value (`plan`, `isPremium`,
  `balance`, `credit`, `price`), and ownership/tenancy (`ownerId`, `userId`,
  `accountId`, `createdBy`). Ordinary client input (name, description, …) is
  never flagged.
- **Probe body:** schema-shaped valid dummies **plus** the privileged fields with
  recognizable probe values (`onyx_admin_probe` / `true` / `999999`). A field the
  schema **already declares is NOT injected** — an API openly accepting it isn't
  mass assignment, and overwriting it would be a false positive.
- **Candidates:** POST/PUT/PATCH with an object-shaped JSON `requestBodySchema`.
  A GET-only spec enqueues nothing; existing scans are otherwise unchanged.
- **Verdict:** 4xx (input validated/rejected) → SAFE. 2xx but the field isn't
  reflected (server ignored it) → SAFE. 2xx **and** an injected privileged field
  is reflected **with our exact probe value** → finding. Value-matching (not just
  the key) is what keeps this safe: an API that merely mentions "role" in an error
  string is not a finding. Optional Gemini **veto-only** judge (never raises alone;
  a throw/null leaves the deterministic verdict standing). Severity HIGH,
  confidence "firm" deterministically / "confirmed" when the judge corroborates.
- **Persistence/surfacing:** stored in `findingJson` (the REDACTED finding) with
  `owaspCategory: API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION`, so it flows
  through the existing T13b `resolveFinding` read path, scoring, PDF, and **lights
  up API3 coverage** with no extra work, and broadcasts like any attack result.
- **Enum safety (T14a lesson):** `MASS_ASSIGNMENT` added to the job
  `attackTypeEnum` — and `BOLA_REPLAY`/`BFLA_PROBE`/`MASS_ASSIGNMENT` added to the
  shared `AttackType` union — with a regression test, so probes can't be silently
  dropped by the worker's `safeParse`.

- **Added:** `server/src/services/mass-assignment.ts`, `server/src/services/__tests__/mass-assignment.test.ts`.
- **Changed:** `validators/schemas.ts` (MASS_ASSIGNMENT in the job enum), `types/shared.ts` (probe types in AttackType), `queues/producer.ts` (`enqueueMassAssignmentJobs`), `queues/worker.ts` (verdict on MASS_ASSIGNMENT + persist findingJson), `controllers/test-run.controller.ts` (enqueue probes before enqueuedAt, count into totalAttacks), `validators/__tests__/replay-job.test.ts` (enum guard); docs/UPDATES.md.
- **Schema/migration:** **none** — reuses `findingJson`, the attack counters, and existing columns. `prisma migrate status` → "Database schema is up to date!"; zero diff under `prisma/`.
- **Tests:** 333 pass (28 files; +16) — candidate selection, probe-body construction (incl. not injecting schema-declared fields), reflection matching (nested, wrong value, key-only mention), and the verdict (2xx+reflected → API3; 4xx → none; ignored → none; non-privileged → none; judge veto/agree/throw/null).
- **Deferred (T14c):** a follow-up GET to prove **persistence** rather than mere reflection.

## 2026-08-31 — T14c: Excessive Data Exposure (API3)

Backend-only. Detects endpoints that return sensitive/internal properties a
client should never see (password hashes, tokens, SSN/card, internal flags, bulk
PII). **Analysis-only — no new attack traffic:** it inspects responses the scan
has already collected.

- **Where analyzed:** each endpoint's **BASELINE** response (T5) — one benign 2xx
  per endpoint, and the table is unique on `(testRunId, endpointId)`, so **dedupe
  is structural**: an endpoint can never produce one finding per payload. When no
  baseline exists (FREE plan skips baseline capture) it falls back to **one
  representative 2xx AttackLog** for that endpoint. Either way exactly one
  response per endpoint is analyzed.
- **Detector** (`data-exposure.ts`, pure + value-aware): credential-grade
  (`password`, `passwordHash`, `pwd`, `hash`, `salt`, `token`, `accessToken`,
  `refreshToken`, `secret`, `apiKey`, `privateKey`, `ssn`, `creditCard`,
  `cardNumber`, `cvv`, `pin`), internal flags (`isAdmin`, `internalNotes`,
  `internal`, `debug`), and PII (`email`, `phone`, `dob`). Keys match
  **whole-key, case-insensitive, `_`/`-` insensitive** (so `passwordHint` and
  `tokenCount` don't match), and each field must carry a **plausible value** —
  bcrypt/argon/hex for hashes, JWT-or-long-opaque for tokens, SSN/card/CVV
  regexes, real-looking emails/phones — so `{"error":"password required"}` and
  `***REDACTED***` placeholders are never flagged.
- **PII is deliberately conservative:** a single record's own `email`/`phone` (the
  "GET /me" case) is NOT flagged; PII only counts **in bulk** (a list of ≥3
  records) or alongside a stronger credential/internal signal.
- **Complements SECRET_LEAK (T1), never duplicates it:** a body already matching
  the SECRET_LEAK pattern (`api_key`/`secret`/`password`/`access_token`/private
  key) returns no exposure finding, so one response never yields two findings.
  Exposure catches what SECRET_LEAK misses — `passwordHash`, SSN/card, internal
  flags, bulk PII.
- **Finding:** category "Excessive Data Exposure", severity **CRITICAL** for
  credential-grade fields else **HIGH**, confidence "firm", owaspCategory
  `API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION`. Evidence names the exposed
  **field names** + the **already-T3-redacted** body shape — never a raw secret.
  Optional Gemini **veto-only** judge, consulted **only for PII-only** findings
  (never for credential-grade), and a throw/null leaves the verdict standing.
- **Persistence/surfacing:** written as its own AttackLog row with `findingJson`
  (like BOLA/BFLA/mass-assignment) + `owaspCategory`, so it flows through the
  existing T13b `resolveFinding` read path, scoring, and PDF, and **lights up API3
  coverage** exactly once per endpoint.
- **Placement:** runs in the worker's run-completion block, guarded by the same
  `updateMany` that flips the run COMPLETED (so exactly once per run), **awaited
  before `scoreAndPersistRun`** so its findings count toward the run score. It
  touches no counters, so the **completion gate is unaffected**. It never throws.
- **Enum safety (T14a lesson):** `DATA_EXPOSURE` added to the job `attackTypeEnum`
  and the shared `AttackType` union, with a regression guard.

- **Added:** `server/src/services/data-exposure.ts`, `server/src/services/data-exposure-scan.ts`, `server/src/services/__tests__/data-exposure.test.ts`, `server/src/services/__tests__/data-exposure-scan.test.ts`.
- **Changed:** `validators/schemas.ts` + `types/shared.ts` (DATA_EXPOSURE), `queues/worker.ts` (run the pass at completion, before scoring), `validators/__tests__/replay-job.test.ts` (enum guard); docs/UPDATES.md.
- **Schema/migration:** **none** — reuses `findingJson`, `owaspCategory`, and existing columns. `prisma migrate status` → "Database schema is up to date!"; zero diff under `prisma/`.
- **Tests:** 360 pass (30 files; +27) — detector positives (hash/JWT/SSN/card/nested/internal flags), negatives (ordinary fields, key-only error mentions, implausible + placeholder values, partial keys, non-2xx/non-JSON), PII conservatism (single record vs bulk vs alongside a strong signal), SECRET_LEAK complement (no double-flag, and the passwordHash case SECRET_LEAK misses), verdict severity/evidence/judge behavior, and the scan pass (one finding per endpoint, clean/no-response cases, never throws).
- **Deferred:** analyzing non-JSON bodies, and per-field allow-listing for APIs that legitimately return e.g. `email` to its owner.
