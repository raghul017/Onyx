# Onyx — Agent Work Log

> A running record of substantive changes made by AI agents (Claude Code) and
> what is planned next. Keep this current: when you finish a meaningful change,
> add a dated entry under **Done**; when you defer something, add it under
> **Next**. Detailed release notes live in [changelog.md](changelog.md); this
> file is the fast, chronological "what happened and why" for whoever picks the
> project up next.

**Live:** frontend https://onyx-engine.vercel.app · backend https://onyx-server-a38v.onrender.com
**Repo:** https://github.com/raghul017/Onyx

---

## How to use this file

- **Done** — newest first. One entry per meaningful push. Include the commit
  short-SHA, the intent, and anything non-obvious a future maintainer needs.
- **Next** — the backlog of known work, grouped by severity/area. Move items up
  to **Done** as they ship; delete them if they stop being relevant.
- **Conventions** — house rules that must not be re-litigated each session.

---

## Conventions

- **Commits:** no `Co-Authored-By` trailer (user preference). Branch off `main`
  only when asked to commit/push; otherwise leave the tree dirty for review.
- **Local-only files (git-ignored, never push):** `DESIGN_SYSTEM.md`,
  `EXPLAIN.md`, `.screenshots/`, `.claude/`, `.env*`.
- **Preview before push** when the user asks: render the page headless and save
  screenshots to `.screenshots/` (git-ignored), then push only on approval.
- **Design system — LIGHT-MONO (current, as of 2026-07-10).** The whole client
  was migrated off the old dark/teal theme. Tokens: surface `#fafafa`, cards
  `#ffffff`, hairline borders `#e6e6e6`, text `#000`/`#333`/`#666`/`#999`/`#ccc`,
  **single blue accent `#3b82f6`** (tints `#93c5fd` / wash `#f0f6ff`), semantic
  severity CRITICAL `#dc2626` · HIGH `#ea580c` · MEDIUM `#ca8a04` · LOW `#3b82f6`
  · INFO `#64748b`, success `#16a34a`, danger bg `#fef2f2` / border `#fca5a5`.
  **SHARP corners (0 radius), NO shadows.** Fonts: **Geist** everywhere (body),
  **JetBrains Mono** for accents/labels/IDs (`.font-mono`) — zero Inter/Satoshi.
  Component classes in `client/src/index.css`: `.mono-btn`, `.mono-btn-ghost`,
  `.mono-card`, `.mono-eyebrow`, `.mono-pill`, all scoped under `.onyx-mono`.
  Anti-slop: one accent, no em-dashes in UI copy, red only when truly broken.
  (The old off-black/teal palette below is retired — do not reintroduce it.)
- **Skills available** (in `.claude/skills/`): `ui-ux-pro-max`,
  `design-taste-frontend`, `gsap-scrolltrigger`, `make-interfaces-feel-better`.
  Use them for any UI polish work.
- **Verify before shipping backend:** `cd server && npm run typecheck` and
  `npm run build`; schema changes go via
  `node -r dotenv/config node_modules/.bin/prisma db push` then `prisma generate`.

---

## Done

### 2026-07-13 — Backend: SSRF cache, DB/WS trims, explained findings, denormalized score

Performance + depth pass on the server (all pushed to `main`):
- **SSRF DNS cache + pool fix** (`ee08ef4`) — memoize the safe/blocked verdict
  per host (60s TTL) so a scan does 1 DNS lookup instead of ~400; raised the
  Prisma pg pool `max` 10→20 (worker concurrency 12 + HTTP headroom). Also
  closed a pre-existing SSRF bypass: bracketed IPv6 literals (`[::1]`,
  `[::ffff:10.0.0.1]`, incl. the hex-normalized `::ffff:a00:1`) now blocked.
- **Per-attack DB + WS trims** (`2dff371`, `dabe830`) — `attackLog.create` +
  counter `increment` run in one `$transaction`, finalize reuses the returned
  row (no re-read), and `TEST_RUN_STATUS` is throttled to ≤1/400ms per run
  (ATTACK_RESULT still per row). Hot path: 4 DB round-trips + 2 WS → 2 + ~1.
- **Explained findings** (`3a8998b` server, `82d738d` client) — new
  `finding-analysis.ts` engine classifies each result (SQL-error disclosure,
  reflected XSS, path-traversal file read, secret leak, auth bypass, stack-trace
  disclosure, 5xx crash) into category + cause + evidence + remediation +
  confidence, from data already captured (no extra traffic). `getSeverity`
  delegates to it. `AttackResult.finding` flows to the live stream + report;
  Dashboard & Report rows are click-to-expand (`FindingDetailPanel`). Dashboard
  row severity now uses the authoritative `finding.severity`.
- **Denormalized run score** (`8425721`) — `TestRun.overallScore`/`scoreLabel`
  computed once at terminal state (`run-score.ts`); `getAllTestRuns` reads it
  instead of loading every log. Backward-compatible (falls back to compute-from-
  logs if columns absent). **`db push` run against prod Neon 2026-07-13** — live.

### 2026-07-10 — Full light-mono UI conversion (all pages + shared shell)

Migrated the entire client off the dark/teal theme to **light-mono** (see the
updated Design-system convention above). Shipped page-by-page to `main`:
Landing, Docs, SignIn/SignUp, Settings, **Profile** (new), Billing (also
flaw-fixed: single visual anchor, balanced current-plan strip, trust row),
History, Report, and the **Dashboard** (full rebuild — clean empty state + 3-step
guide replacing the murky ghost skeleton; live console mirrors Report). Shared
shell: AppHeader (avatar always visible), GoBackButton (now a minimal text link),
OrgSwitcher, ColdStartBanner, DomainVerifyPanel, DashboardCommand. Font unified
to Geist app-wide (zero Inter/Satoshi). Keep-warm cron added for Render cold
starts (`d2552ec`).

### 2026-07-02 — Dashboard whole-page recompose (fix "two floating boxes" feel)

The v2 empty state fixed the panel but the *page composition* still read amateur:
two separate rounded cards floating on a void, a `>_ NEW ATTACK RUN` terminal
eyebrow, a fully-rounded pill URL input, an always-visible red Stop button, a
page-level gradient wash, and `rounded-2xl` everywhere. Rebuilt
[Dashboard.tsx](client/src/pages/Dashboard.tsx) + the idle/active bodies as ONE
continuous console surface:
- Page background `#0A0A0A`; removed the page-level `c5-animated-gradient` blob.
- A real page title ("Command center" + one-line sub) instead of the mono eyebrow.
- One bordered `#0C0D0E` surface (radius 10px) containing a **toolbar row**
  (terminal-glyph URL input at 8px radius + a single teal "Launch scan" button)
  divided by a hairline from the **body**. Stop button only renders while a run
  is active (an idle destructive button is noise).
- Idle ghost skeleton now mirrors the true two-column live layout (findings table
  + Latency/Top-Vulnerable rail) so the preview looks complete, with the launch
  card centered over it. Active state fills the same surface (dropped its own
  outer card chrome). Console is content-height, not a stretched empty box.

### 2026-07-02 — Dashboard idle state v2: "Ghost Command Center" (killed the AI-tell gradient)

The gradient-hero idle state (below) still read as AI-generated. Ran deep research
on how premium dev tools (Linear, Vercel Geist, Sentry) design empty dashboards;
the teal+orange gradient + gradient text was the #1 tell. Rebuilt the idle state
as a "Ghost Command Center" ([DashboardCommand.tsx](client/src/components/DashboardCommand.tsx),
`IdleCommandCenter`):
- Near-black `#0A0A0A`, 1px hairline borders (white @ ~6-8%), depth from surface
  tint not shadow, 6-8px radii. NO gradient, NO glow, NO gradient text.
- A dimmed, inert **skeleton of the real dashboard** (0-value metric tiles +
  findings table with real column headers + fading skeleton rows) so the user
  sees what will appear, with ONE left-biased "No active scans → Launch a scan"
  card over it.
- ONE rationed accent: a slightly deepened/desaturated teal (`#5fb3b8`) on the
  primary button + live dot only — keeps brand continuity without the AI look.
- Icons switched to **Phosphor** line icons (matches the landing family), muted
  gray. The launch-form Play/Square/Terminal re-exports stay on lucide.
Previewed headless; typecheck + build clean.
Design note: the earlier WebGL ShaderBackground is no longer used on the
dashboard (still used by SignIn). Accent decision: keep teal, drop the gradient.

### 2026-07-02 — Dashboard idle state: gradient hero + smooth idle→active transition

The idle "command center" read flat (small icon + text + faint blob). Rebuilt in
[DashboardCommand.tsx](client/src/components/DashboardCommand.tsx):
- Real WebGL gradient hero (`ShaderBackground`, the same one on SignIn) mounted
  ONLY on the idle panel and lazy-loaded, so it never competes with the live
  stream for frames. Radial + vertical scrims keep text WCAG-legible over it.
- Stronger type: larger Satoshi headline, a "Standing by" chip with a pulsing
  live dot, tightened copy, cleaner capability chips.
- framer-motion crossfade: idle fades in, and the active stream fades/slides in
  when the run starts (state-transition feedback) — so hitting Execute reads as a
  smooth move into the live view. All gated behind `prefers-reduced-motion`.
Previewed headless with software WebGL (`.screenshots/dashboard-idle-new.png`);
typecheck + build clean.

### 2026-07-02 — Billing page brand redesign

Rebuilt [Billing.tsx](client/src/pages/Billing.tsx) to the app design language
(was pure `bg-black` + generic cyan). Now: off-black `#080808` surface, teal
`#73bfc4` accent, shadow-as-border cards, Satoshi/JetBrains-Mono type, framer-
motion staggered card enter, `GoBackButton`, a current-plan strip, `tabular-nums`
prices, and `active:scale-[0.96]` CTAs. Replaced the jarring native
`alert()`/`confirm()` popups with an inline notice banner and an in-page
"Are you sure? / Yes, cancel / Keep it" confirmation. Previewed headless in FREE
and PRO states (`.screenshots/billing-{free,pro}.png`); typecheck clean.

### 2026-07-02 — Docs, butter-smooth attack stream, remaining audit fixes

- **Docs:** added this work-log (`AGENTS.md`), a security-hardening section in
  [changelog.md](changelog.md), and a pointer from the README.
- **Dashboard attack stream feels smooth** — the live log used to snap: only the
  top row animated and it slid a harsh 10px, KPI numbers jumped, the progress bar
  and severity bar changed width instantly. Now:
  - Softer row enter (6px slide on `cubic-bezier(0.2,0,0,1)`, GPU-composited) plus
    a fading teal "just arrived" flash on the newest row.
  - Count-up KPIs via a new `useCountUp` hook (rAF tween, exact landing,
    `tabular-nums` so width never shifts).
  - Smooth width transitions on the progress + severity bars (`onyx-progress-fill`).
  - Everything gated behind `prefers-reduced-motion`.
- **Remaining audit fixes:** bcrypt 8→12; `uniqueSlug` retries on the unique
  violation (no TOCTOU); Zod validation on billing + org request bodies with a
  60-char org-name cap; invites still can't grant OWNER.

### 2026-07-02 — Backend security + reliability hardening (`68164bb`)

Audited the whole backend (auth, attack pipeline, billing, orgs, data) and fixed
all confirmed CRITICAL + HIGH defects in one pass. Schema pushed to Neon;
typecheck + build clean.

**Critical**
- **Attack runs no longer hang in `ATTACKING` forever.** A BullMQ job that
  exhausted its retries never incremented `completedAttacks`, so
  `completedAttacks >= totalAttacks` was never true and the run stuck (also
  burning the user's active-run slot). Added a shared
  `finalizeIfComplete` + `recordFailedAttempt` path in
  [worker.ts](server/src/queues/worker.ts); the `failed` handler now counts the
  terminal failure and finalizes.
- **Worker drops jobs for terminal runs** — `processAttackJob` re-reads run
  status up front and skips aborted/deleted runs, so they stop firing at the
  target and can't resurrect state.
- **Billing `/verify` can't hand out free paid plans** — now requires
  `status === "active"` (was accepting `created`/`authenticated`) and the
  subscription must belong to the caller (`notes.userId`).
- **Webhook is forgery/replay-resistant** — constant-time signature compare,
  `WebhookEvent` idempotency ledger, and `subscription.activated` re-verifies
  against Razorpay's real state before upgrading.
- **`resolvePlan` defaults to FREE, never PRO** for unknown plan ids.

**High**
- JWT verification pinned to `HS256` (middleware + OAuth state).
- Google OAuth requires `verified_email` before account-linking (takeover fix).
- PDF export gated on the effective (org-aware, expiry-aware) plan; org-owned
  runs (`userId=null`) authorized by org membership instead of skipping the check.
- `getEffectivePlan` treats expired paid plans (`planExpiresAt < now`) as FREE.
- `guardLastOwner` runs inside the mutation transaction (no zero-owner race).
- Org invite acceptance bound to the invited email (was a bearer link).
- `/attack` route got `checkQuota("testRun")` (was quota-bypassable).
- SSRF guard fails closed on resolver errors, checks all A/AAAA records, and
  blocks IPv4-mapped IPv6, `::`, decimal/hex IP literals, and CGNAT.
- Test-run reads (`get`/`logs`/`abort`/`delete`) unified to owner-or-org-member
  access; abort **and** delete drain queued jobs.

**Schema:** `WebhookEvent` model; `users.razorpaySubId` unique; `TestRun`
`(userId, createdAt)` + `(orgId, createdAt)` indexes.

### 2026-07-02 — Attack firing performance (`a9fd480`)

Made attack firing smooth and continuous instead of slow/batchy:
- Parallelized Gemini payload generation (`Promise.all`), flip to `ATTACKING`
  immediately so the first endpoint's jobs fire while later ones still generate.
- Removed the redundant producer `group` throttle; worker concurrency 5→12,
  limiter retuned to `3/100ms` (~30/s, evenly paced).
- Added `TestRun.enqueuedAt` sentinel so early-finishing jobs can't complete a
  run mid-enqueue.

### Earlier (see [changelog.md](changelog.md))

OAuth (Google/GitHub server-side redirect flow), app-wide brand redesign of the
landing page + Dashboard / History / Report, org multi-tenancy + RBAC + invites,
domain-ownership verification, Razorpay billing, PDF export, CVSS severity scoring.

---

## Next

Ordered by priority. Move to **Done** as shipped.

### Backend — deferred MEDIUM / LOW (from the 2026-07-02 audit)
- [ ] OAuth `state` is not bound to a browser/session — bind it (cookie nonce or
      PKCE) so a stolen `state` can't be replayed. (Deferred: needs a cookie
      roundtrip; must not break the live OAuth flow.)
- [ ] JWT is passed in the WebSocket handshake **query string** (logged by
      morgan) — move to a subprotocol header or short-lived ticket.
- [ ] Org billing is effectively **unwired**: webhooks only ever update `User`,
      never `Organization`. Decide whether orgs are billable yet; if so, wire
      `subscription.*` events to the org by `razorpaySubId`.
- [x] ~~`bcrypt` cost 8 → 12.~~ (done 2026-07-02)
- [x] ~~`uniqueSlug` TOCTOU — retry on P2002.~~ (done 2026-07-02)
- [x] ~~Zod validation on billing/org bodies + `name` length cap.~~ (done 2026-07-02)

### Product / UI
- [x] ~~"Onyx Instrument" dashboard redesign (off-black + amber).~~ **Superseded**
      by the 2026-07-10 light-mono conversion — the whole app, Dashboard included,
      is now light-mono blue, not off-black/amber. `PLAN-dashboard-instrument.md`
      is historical; do NOT build it.
- [x] ~~Remaining page redesigns.~~ (done 2026-07-10 — every page is light-mono)
- [x] ~~Dashboard attack stream butter-smooth (per-row enter, smooth progress,
      count-up KPIs).~~ (done 2026-07-02 — `useCountUp`, `onyx-progress-fill`,
      `onyx-row-flash`)

### Backend — remaining (lower priority, none pressing)
- [ ] Targeted job draining — `drainTestRunJobs` scans the whole BullMQ queue on
      each abort/delete; track per-run job ids (Redis set) to target them.
- [ ] Read-caching for hot reads (Redis is queue-only today).
- [ ] Prisma **migrations** instead of `db push` (no migration history now).
- [ ] Structured logging / metrics (currently `console.log` + morgan).
- [ ] **Phase 2 findings — baseline diffing.** Send a benign control request per
      endpoint and diff it vs the payload response to CONFIRM blind/boolean/
      time-based issues. Deferred: doubles request volume (conflicts with "fast").

### Roadmap (bigger bets — see changelog Phase 2–5)
- [ ] Audit logs (immutable record of sensitive actions).
- [ ] Public REST API + API keys; CLI (`npx onyx-scan …`); GitHub Action.
- [ ] Diff / regression view between two runs; SARIF export.

---

_Maintained by AI agents working on Onyx. Keep it honest and current._
