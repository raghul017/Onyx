# PLAN — "Onyx Instrument" dashboard redesign (paused, build next session)

> Status: **APPROVED, paused to build next session.** Accent decision = **warm
> amber / signal-orange** (user chose this). Scope = **both idle + live states**
> (I chose, per user). This doc is self-contained: everything needed to build is
> here — no re-research required. Local only (this file is git-ignored via the
> DESIGN_SYSTEM/EXPLAIN pattern? NO — it's tracked; fine to commit).

## Why we're doing this

The dashboard kept reading as "basic / noob cybersecurity template." Root cause
(confirmed by deep research across Linear, Vercel, Raycast, Resend, Warp, Depot,
Doppler, Socket, Modal, Trigger.dev, Inngest, Baseten, Fly, Teenage Engineering):

1. **Teal/cyan on black = the #1 cyber-security cliché.** Every generic SOC
   dashboard looks like this. User explicitly rejected it.
2. **Flat & lifeless** — the live streaming data (the actual product) was a boring
   table. The data should be the hero and feel ALIVE.
3. **Not enough craft signal** — no mono-as-voice, no tabular numerals, no
   designed motion, no single rationed accent.

## The direction — "Onyx Instrument"

A precision **mission-control instrument** that reads a live attack signal.
Off-black paper, monospace as the product voice, exposed labels, ONE hot
industrial amber accent, severity as the only other chromatic system. The
streaming attack feed IS the hero. (Teenage-Engineering / Bloomberg-terminal
reimagined — the one aesthetic where look == function for a security scanner.)

### Palette (exact hex — lock these)

```
Background (warm off-black, NEVER #000, NEVER slate):  #0B0B0C
Surface / panels:                                       #141416
Raised surface:                                         #1B1B1E
Hairline dividers (1px, NO shadows):                    #26262A  (or white @ 6-8%)
Text primary (warm white):                              #F5F4F2
Text secondary:                                         #A1A1A6
Text muted / labels:                                    #6B6B70

ACCENT — "the instrument" (Signal Amber):               #FF810A   <- already Onyx's HIGH-severity brand orange, so not foreign
  amber hover:                                          #FF9433
  amber text-on-dark:                                   #FFA24D
  amber tint bg:                                        rgba(255,129,10,0.10)
  Used ONLY for: LIVE pulse, primary CTA, active-scan caret, sparkline stroke,
  active nav/indicator. One accent, ruthlessly.

SEVERITY ramp (findings data ONLY — never mixed with the amber accent):
  Critical  #F0412E   (slightly desaturated from pure red so it doesn't collide w/ amber)
  High      #F5842C   (note: keep distinct from accent amber — use only on data rows)
  Medium    #E6B93E
  Low       #7C7C82   (gray = intentional non-alarm)
  Info      #4FA66A   (muted green dot)
```

**Collision risk to watch:** the accent (#FF810A) and severity-High (#F5842C) are
both orange. Rule: **accent amber only appears on chrome/controls/live indicators;
severity colors only appear on data (row left-borders, severity chips, counts).**
They never sit adjacent. If it still reads muddy in preview, shift severity-High
toward #F76808 (burnt) and keep accent brighter, OR make the accent slightly more
red (#FF6A2C coral) — decide from the live preview.

### Type

- **Display / headlines:** Satoshi (already loaded) or Inter, weight 600, tracking
  `-0.02em`, large (40-64px) for the empty-state hero. Editorial confidence.
- **Mono as the product VOICE:** JetBrains Mono (already loaded) for ALL data,
  table cells, metric numbers, log lines, section labels. (Berkeley Mono is the
  premium ideal but not worth a paid license now — JetBrains Mono is the free
  equivalent and already in the app.)
- **Labels:** mono, **10px, ALL-CAPS, 0.12em tracking**, muted `#6B6B70` — the
  Teenage-Engineering label treatment.
- **All numerics:** `font-variant-numeric: tabular-nums` everywhere (already have
  the `useCountUp` hook — keep it).

### Layout (asymmetric, instrument-panel)

One continuous console surface (keep the unified-surface win from the last pass —
do NOT go back to floating boxes). Structure:

- **Top bar of the console:** `● LIVE` amber pulse + spec name (mono) + a
  full-width thin **live sparkline** (findings/sec) acting as the instrument's
  signal readout.
- **Left rail (narrow ~200px):** scan metrics as an instrument panel — dim tiles
  that light up: Endpoints · Payloads sent · Findings · Peak severity. Mono
  numbers, count-up on change, tabular-nums. Reads `—` when idle (design the zeros).
- **Center (hero):** the streaming findings feed — a **flat table, 1px hairline
  rows, NO card, NO shadow**, each row a 1px LEFT border keyed to severity,
  newest at top. Columns: Time · Method · Endpoint · Severity · Status · Latency
  (all mono, tabular-nums on the numeric cols, fixed-width so no reflow).
- **Radii:** 4-6px MAX on interactive elements; tables/panels square-cornered
  (instrument precision). This is a deliberate break from the current rounded-lg.

### Signature move

**Exposed-machinery monospace instrument panel + one amber "signal."** Every row
shows the actual payload/method/endpoint in mono ("show the work is the work").
The only thing that ever glows amber is the live pulse + active caret. Severity is
the only other color and only on real findings. Nothing decorative — every colored
pixel means something.

### Live-data treatment (make it feel ALIVE — this is the whole point)

Buildable techniques (all researched, sourced, and reduced-motion-gated):
1. **New-row enter:** fade + 4px slide-up, staggered ~40ms, FIXED row height (no
   reflow). Animate opacity/transform only. (Streamdown `slideUp`; Framer
   `AnimatePresence` + `layout`.)
2. **Flash-on-insert:** 300ms severity-tinted background pulse then fade to
   transparent on each new row (`@keyframes flash-in { from{bg: severity@14%} to{transparent} }`).
   (Grafana/Datadog live-tail; trading flash-on-tick.) Re-trigger via keyed remount.
3. **Active-attack line:** typewriter reveal of the currently-firing endpoint with
   an amber blinking block caret `▋`.
4. **Metric tiles:** count-up on change (reuse `useCountUp`), tabular-nums.
5. **Live-tail behavior:** auto-scroll pinned to bottom (or top, newest-first);
   show a **"↓ N new findings" amber pill** when the user scrolls away. Sticky
   pulsing `● LIVE` amber dot in the console top bar.
6. **Top sparkline:** thin live findings/sec line, amber stroke, pulsing leading
   dot — animates continuously so the instrument is always "breathing."
7. **Perf discipline:** buffer WS messages in a `useRef`, flush on rAF cadence
   (don't setState per message); `content-visibility:auto` + fixed row height +
   append-only keys for zero-jank at scale. (We already RAF-tween counters.)

### Empty / idle state (armed instrument — NOT a sad card)

Combine the two best researched compositions:
- Full-bleed off-black console surface.
- The live findings table rendered BEHIND at ~12-15% opacity as a **looping ghost
  demo** of streaming payloads (so the tool looks armed and alive before Launch) —
  we already have the ghost-skeleton; upgrade it to a subtle looping shimmer.
- Over it, a **left-biased** block: big Satoshi headline (e.g. "Paste a spec.
  Watch it break." — punchy, confident, editorial), one line of mono sub-copy,
  and ONE amber CTA **"Launch scan"** that focuses the URL input.
- A single pulsing amber `● READY` status LED so at least one thing is alive.
- Design the zeros: left-rail metric tiles read `—` in mono, ready to light up.

## Files to touch

- `client/src/pages/Dashboard.tsx` — page shell, toolbar row, left rail, palette.
- `client/src/components/DashboardCommand.tsx` — idle (armed ghost) + live
  (streaming instrument) bodies, sparkline, flash rows, LIVE pill.
- `client/src/index.css` — new CSS tokens/keyframes: `flash-in`, amber caret
  blink, sparkline pulse, reduced-motion guards. Add amber accent vars.
- Maybe `client/src/hooks/useCountUp.ts` — already exists, reuse.
- New tiny component(s): `LiveSparkline` (SVG polyline + pulsing last point),
  optionally `LivePill`.
- Icons: Phosphor (already switched), muted, thin.

## Guardrails (do NOT repeat past mistakes)

- Keep ONE continuous console surface — no floating boxes on a void.
- Accent amber is RATIONED — chrome/live only. Severity colors on data only.
- Off-black `#0B0B0C`, never `#000`, never slate.
- Everything numeric = tabular-nums. Data = mono.
- All motion behind `prefers-reduced-motion`.
- Preview headless in BOTH idle and (mock-data) live states before pushing.
- Typecheck + build clean; update AGENTS.md + changelog; push (no Co-Authored-By).

## Open decisions to confirm while building (from preview, not upfront)

1. Accent-vs-severity-High orange collision — resolve from the live preview
   (options noted in Palette section).
2. Whether the app-wide teal brand (landing, History, Report, Billing) should
   migrate to this amber instrument language too, or the dashboard leads and the
   rest follows later. **Likely: dashboard leads now, propose an app-wide pass
   after user sees it.** Confirm with user.
3. Headline copy ("Paste a spec. Watch it break." vs calmer "No active scans").
   Show both in preview.

## Research provenance (so we don't re-run it)

Full research is in the task outputs from 2026-07-02/03: Vercel/Linear tokens,
streaming-log techniques (Streamdown/Warp/Grafana), trading-terminal live-data
(flash-on-tick, odometer, sparkline), empty-state compositions, award-tier trends,
and 12+ real product palettes (Depot amber #ffc53d, Modal lime, Doppler violet,
Socket magenta, Raycast coral #FF6363, Resend purple, Warp, Fly, Inngest matcha,
Baseten, Trigger lime+violet, Family candy). Key takeaway that shaped this plan:
every design-led tool picks ONE non-blue accent + mono-as-voice + off-black +
tabular numerals + designed motion. Amber specifically = Depot's exact choice and
reads "expensive/instrument," and it's already Onyx's HIGH-severity brand orange.
```
