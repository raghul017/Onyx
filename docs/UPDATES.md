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
