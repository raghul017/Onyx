# Onyx Design System, Skills & Reusable Prompts

A portable reference for building professional, anti-slop UI, distilled from the
Onyx redesign. Drop this into any project and hand it to your coding agent so it
knows **which skills to use, which references to pull, and exactly what to
prompt** to get design-grade output instead of generic AI UI.

---

## 1. The skills (install these first)

These are Claude Code / Cursor / Codex **skills** — markdown capability files the
agent reads before designing. Install into `.claude/skills/` (project) or
`~/.claude/skills/` (global). Restart the agent after installing.

| Skill | What it does | Install |
|---|---|---|
| **ui-ux-pro-max** | 67 styles, 96 palettes, 57 font pairings, 25 charts, 99 UX rules, 13 stacks. Has a CLI (`scripts/search.py --design-system`) that outputs a full design system for a brief. | `npx uipro-cli init --ai claude` (or clone → `.claude/skills/`) |
| **design-taste-frontend** | Anti-slop frontend skill. "Design read" + 3 dials (variance/motion/density), the AI-tells ban list (em-dashes, section-number eyebrows, screaming zeros, 3 equal cards, fake screenshots), palette/type discipline. | Clone `github.com/Leonxlnx/taste-skill` → copy `skills/taste-skill` into `.claude/skills/design-taste-frontend` |
| **make-interfaces-feel-better** | Micro-detail polish: concentric radii, shadow-as-border, optical alignment, interruptible animations, split+stagger enters, tabular-nums, text-wrap balance/pretty, scale-on-press, 40×40 hit areas, never `transition:all`. | Clone `github.com/jakubkrehel/make-interfaces-feel-better` → copy the skill folder |
| **gsap-scrolltrigger** | Official GSAP ScrollTrigger: scrub, pinning, batch, containerAnimation, `useGSAP()` cleanup, reduced-motion. Use for scroll-driven reveals. | Clone `github.com/greensock/gsap-skills` → copy `skills/gsap-scrolltrigger` |

**How to invoke in a session:** `Skill(name)` or type `/<skill-name>`. For
ui-ux-pro-max always start with:
`python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<product> <industry> <vibe>" --design-system -p "<Project>"`

---

## 2. MCP servers (design references + components)

MCPs give the agent live tools. **You must add these interactively** (`/mcp` in
Claude Code, or claude.ai → Settings → Connectors → Add custom connector). A
non-interactive/headless session cannot run the OAuth/connector flow.

| MCP | Why | How |
|---|---|---|
| **Magic MCP (21st.dev)** | `21st_magic_component_builder` / `_inspiration` / `logo_search` — generate & fetch real UI components + brand logos on demand. | `npx @21st-dev/magic` install, or add via `claude mcp add`. Needs a 21st.dev API key. |
| **Refero MCP** | Connects the agent to a curated library of **real product screens/flows** ("studies before it builds"). Best for research-before-design. | refero.design → "Connect MCP" → add the custom connector URL in claude.ai/Claude Code. |
| **Figma MCP** (if you design in Figma) | Read designs into code / push code to Figma, design tokens, Code Connect. | Official Figma MCP; add as connector. |

---

## 3. Design-reference sites (for humans + as prompt fuel)

Use these to *look*, then translate the pattern into the project's own system.

| Site | Use it for |
|---|---|
| **refero.design** | Largest library of real product screenshots by **page-type / flow / UX-pattern / UI-element**. Search "Dashboard", "Onboarding flow", "Empty states", "Billing & Plans". Has an MCP + image-search. The taxonomy itself is a great pre-build checklist. |
| **uiverse.io/design** | **AI-first portable design systems** (each ships a `DESIGN.md`). Study systems near your aesthetic — e.g. **Halo** (architectural near-black + tight vibrant signal colors) ≈ dark dev-tools; **Forge** (industrial dark, ember-orange, dense technical) ≈ security/observability. Original uiverse.io also has 1000s of free CSS components (buttons, loaders, cards). |
| **checklist.design/browse** | Per-component / per-page **UX best-practice checklists**. Use as a QA pass before shipping a page (forms, tables, modals, empty states). |

> **Pattern that works:** pick a reference on Refero → name the system family on
> uiverse that matches your vibe → run it through the skills → build in your own
> tokens. Never copy pixels; copy the *decisions*.

---

## 4. The Onyx design tokens (this project's system)

Reuse these so new pages match instantly.

```
Surfaces        page #080808 · panel #0B0C0D · inset #070809 (all off-black, never pure #000)
Ring/border     shadow-as-border: shadow-[0_0_0_1px_rgba(255,255,255,0.07)]  (hover → teal 0.3)
Accent (brand)  teal #73bfc4  (primary), cyan #22d3ee / #06b6d4, slate #8da0ce
Warm pop        orange #ff810a  — SEMANTIC ONLY (HIGH severity / warnings), never decorative
Severity        CRITICAL #ef4444 · HIGH/WARN #ff810a · MEDIUM #d8b24a · INFO/slate #8da0ce
Fonts           Satoshi Variable (display) · Inter (body) · JetBrains Mono (code/data/labels)
Icons           @phosphor-icons/react (duotone) — NOT thin Lucide outlines for hero/feature icons
Radii           concentric: card 24-28px → panel 16-18px → row 12px → chip 6px
Motion          MOTION:6 restrained; framer-motion reveals + GSAP scrub; always prefers-reduced-motion
Signature CSS   .c5-animated-gradient (moving hero blobs) · .c5-text-gradient (gradient INSIDE text)
                .onyx-gradient-border (animated conic ring, teal/cyan/slate) · .onyx-marquee (infinite tape)
```

---

## 5. Reusable prompts (copy-paste for the next project)

### 5.1 — Kickoff (design read + system)
```
Use the ui-ux-pro-max and design-taste-frontend skills. First give me a one-line
"design read" (page kind, audience, vibe, design family) and set the 3 dials
(DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY). Then run
ui-ux-pro-max --design-system for "<product> <industry> <vibe>" and lock ONE
accent color + a tight token set (surfaces, fonts, radii, motion). Do NOT start
coding until the read + tokens are agreed.
```

### 5.2 — Build a page/section (anti-slop)
```
Build <page/section> using our locked tokens. Follow design-taste-frontend's
anti-slop rules: NO em-dashes anywhere, NO section-number eyebrows, max 1 eyebrow
per 3 sections, NO 3 equal feature cards, NO fake div screenshots, one accent
color only, off-black not pure black. Use Phosphor duotone icons. Show, don't
tell: give feature/step cards a real mini-preview of the product, not just text.
Screenshot it (headless) and show me before committing.
```

### 5.3 — Polish pass
```
Run the make-interfaces-feel-better skill over <files>. Apply: concentric radii,
shadow-as-border (not hard borders), text-wrap balance on headings + pretty on
body, tabular-nums on dynamic numbers, active:scale-[0.96] on buttons, kill every
transition:all, focus-visible rings, 40x40 hit areas. Present changes as a
before/after table.
```

### 5.4 — Motion
```
Use the gsap-scrolltrigger skill. Add ONE motivated scroll effect (reveal that
tells a story), with useGSAP() for cleanup and a prefers-reduced-motion fallback.
No scroll-hijacking, no random-scatter SplitText on a B2B page. Motion must be
motivated, not decoration.
```

### 5.5 — Dashboard / data page
```
This is an OPERATIONAL dashboard. Apply the traffic-light rule (red ONLY when
something is broken — no screaming red zeros at idle), F-pattern (critical signal
top-left), progressive disclosure (summary → drill-down), a plain-language
insight line ("here's what it means"), sparklines over big charts, bars over pie.
Design a real empty/idle state that previews what will populate — never an empty
table.
```

### 5.6 — Research before building
```
Before building <page>, pull real references: use the Refero MCP (or refero.design
taxonomy) for "<page-type>" and "<flow>", and name the closest uiverse design-
system family to our aesthetic. Summarize the 3-5 concrete layout/interaction
decisions worth borrowing, then build in OUR tokens.
```

---

## 6. Pre-flight checklist (mechanical — run before every commit)

- [ ] `grep -rn "—\|–"` in visible strings → **0** (em-dash ban)
- [ ] Eyebrow count ≤ `ceil(sections / 3)`; no `01/02/03` number labels
- [ ] One accent color across the whole page; orange only where semantic
- [ ] No pure `#000000`; off-black surfaces
- [ ] `transition:all` → specific properties; focus-visible rings present
- [ ] Headings `text-balance`, body `text-pretty`, numbers `tabular-nums`
- [ ] `prefers-reduced-motion` respected on every animation
- [ ] Empty/loading/error states designed (not just the happy path)
- [ ] `tsc --noEmit` clean + build succeeds + headless screenshot reviewed

---

*Assembled during the Onyx landing + app redesign. Skills: ui-ux-pro-max,
design-taste-frontend, make-interfaces-feel-better, gsap-scrolltrigger.
References: refero.design, uiverse.io, checklist.design.*
