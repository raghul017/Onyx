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
- **Design system:** brand off-black (`#080808` / `#0B0C0D` / `#070809`), teal
  accent (`#73bfc4` + cyan `#22d3ee`/`#06b6d4`), slate `#8da0ce`, semantic
  severity palette (CRITICAL `#ef4444`, HIGH `#ff810a`, MEDIUM `#d8b24a`,
  LOW `#73bfc4`, INFO `#8da0ce`). Fonts: Satoshi (display), Inter (body),
  JetBrains Mono (code). Anti-slop: one accent color, off-black not pure black,
  no em-dashes in UI copy, red only when something is actually broken. Reusable
  CSS lives in `client/src/index.css` (`c5-animated-gradient`, `c5-text-gradient`,
  `onyx-row-enter`, `onyx-gradient-border`) — reuse before inventing.
- **Skills available** (in `.claude/skills/`): `ui-ux-pro-max`,
  `design-taste-frontend`, `gsap-scrolltrigger`, `make-interfaces-feel-better`.
  Use them for any UI polish work.
- **Verify before shipping backend:** `cd server && npm run typecheck` and
  `npm run build`; schema changes go via
  `node -r dotenv/config node_modules/.bin/prisma db push` then `prisma generate`.

---

## Done

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
- [ ] Remaining page redesigns to the brand bar: **Billing**, **Settings**,
      **InviteAccept** (Dashboard / History / Report already done).
- [x] ~~Dashboard attack stream butter-smooth (per-row enter, smooth progress,
      count-up KPIs).~~ (done 2026-07-02 — `useCountUp`, `onyx-progress-fill`,
      `onyx-row-flash`)

### Roadmap (bigger bets — see changelog Phase 2–5)
- [ ] Audit logs (immutable record of sensitive actions).
- [ ] Public REST API + API keys; CLI (`npx onyx-scan …`); GitHub Action.
- [ ] Diff / regression view between two runs; SARIF export.

---

_Maintained by AI agents working on Onyx. Keep it honest and current._
