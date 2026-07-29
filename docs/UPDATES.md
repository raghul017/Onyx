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
