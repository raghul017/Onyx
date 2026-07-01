# AI Frontend Design Toolkit — Skills, MCPs, References & Prompts

A **portable, project-agnostic** kit for making any coding agent (Claude Code,
Cursor, Codex) produce professional, "designed-not-generated" UI. Copy this file
into any repo, install the skills + MCPs below, and use the prompts. Nothing here
is tied to one product.

---

## 1. Skills — install these first

Skills are markdown capability files the agent reads before designing. Put them in
`.claude/skills/` (per-project) or `~/.claude/skills/` (global). **Restart the
agent after installing.** Invoke with `Skill(name)` or `/<skill-name>`.

| Skill | What it gives you | Install |
|---|---|---|
| **ui-ux-pro-max** | 67 styles · 96 palettes · 57 font pairings · 25 chart types · 99 UX rules · 13 stacks. A CLI generates a full design system from a one-line brief. | `npx uipro-cli init --ai claude` — or clone the repo and copy into `.claude/skills/` |
| **design-taste-frontend** | Anti-slop engine: "design read" + 3 dials (variance / motion / density), a hard **AI-tells ban list**, palette + type discipline, layout diversification rules. | Clone `github.com/Leonxlnx/taste-skill`, copy `skills/taste-skill` → `.claude/skills/design-taste-frontend` |
| **make-interfaces-feel-better** | Micro-detail polish: concentric radii, shadow-as-border, optical alignment, interruptible animations, split+stagger enters, tabular-nums, text-wrap, scale-on-press, hit areas. | Clone `github.com/jakubkrehel/make-interfaces-feel-better`, copy the skill folder |
| **gsap-scrolltrigger** | Official GSAP ScrollTrigger: scrub, pin, batch, containerAnimation, `useGSAP()` cleanup, reduced-motion. | Clone `github.com/greensock/gsap-skills`, copy `skills/gsap-scrolltrigger` |

**First command for any project** (after installing ui-ux-pro-max):
```
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<product> <industry> <vibe>" --design-system -p "<Project>"
```

---

## 2. MCP servers — real references & components on demand

MCPs give the agent live tools. **Add them interactively** (`/mcp` in Claude Code,
or claude.ai → Settings → Connectors → Add custom connector). A headless/
non-interactive session can't run the OAuth flow, so do this yourself once.

| MCP | Why it matters | How to add |
|---|---|---|
| **Refero MCP** | Connects the agent to a curated library of **real product screens & flows** — "studies before it builds." Best single upgrade for design quality. | refero.design → "Connect MCP" → add the connector URL |
| **Magic MCP (21st.dev)** | On-demand **component generation + inspiration + logo search** (`21st_magic_component_builder`, `_inspiration`, `logo_search`). | `npx @21st-dev/magic` / `claude mcp add`; needs a 21st.dev API key |
| **Figma MCP** | Design-to-code and code-to-design, tokens, Code Connect — if your workflow includes Figma. | Official Figma MCP; add as a connector |
| **shadcn MCP** | Search/insert shadcn/ui components + examples for React/Tailwind projects. | `claude mcp add` the shadcn registry server |

---

## 3. Reference sites — look here, then translate (don't copy pixels)

| Site | Use it for |
|---|---|
| **refero.design** | The largest library of **real product screenshots** by page-type / flow / UX-pattern / UI-element (Dashboard, Onboarding, Empty states, Billing…). Has an MCP + image-search. The taxonomy alone is a pre-build checklist. |
| **uiverse.io/design** | **AI-first portable design systems**, each with a `DESIGN.md` you drop into a repo. Study the family closest to your vibe (dark near-black + signal colors, editorial, industrial, fintech, etc.). The classic **uiverse.io** also has thousands of free CSS components (buttons, loaders, cards). |
| **checklist.design/browse** | Per-component / per-page **UX best-practice checklists** (forms, tables, modals, empty states). Use as a QA pass before shipping a page. |
| **mobbin / godly / land-book** *(optional)* | More real-world screenshot galleries for landing pages and app flows. |

> **Workflow that works:** find a real screen on Refero → name the closest uiverse
> design-system family → run the brief through the skills → build in **your own**
> tokens. Borrow the *decisions*, never the pixels.

---

## 4. Lock a token set per project (fill this in each time)

Before coding, agree ONE small token set so every page matches. Template:
```
Surfaces      page ____ · panel ____ · inset ____   (off-black/off-white, never pure #000/#fff)
Border        prefer shadow-as-border ring over hard borders (adapts to any bg)
Accent        ONE primary accent ____   (lock it; use everywhere; don't drift)
Semantic      success ____ · warning ____ · danger ____   (meaning only, not decoration)
Fonts         display ____ · body ____ · mono ____
Icons         one set (Phosphor duotone / Lucide / Tabler) — don't mix
Radii         concentric scale: card __ → panel __ → row __ → chip __
Motion        dial 1-10; framer-motion reveals + GSAP scrub; always prefers-reduced-motion
```

---

## 5. Reusable prompts (copy-paste)

### 5.1 Kickoff — design read + system
```
Use the ui-ux-pro-max and design-taste-frontend skills. Give me a one-line
"design read" (page kind, audience, vibe, design family) and set the 3 dials
(VARIANCE / MOTION / DENSITY). Run ui-ux-pro-max --design-system for
"<product> <industry> <vibe>" and lock ONE accent + a tight token set. Don't
write code until the read + tokens are agreed.
```

### 5.2 Build a page — anti-slop
```
Build <page> using our locked tokens. Follow design-taste-frontend's anti-slop
rules: NO em-dashes anywhere, NO section-number eyebrows (max 1 eyebrow per 3
sections), NO 3 equal feature cards, NO fake div screenshots, ONE accent color,
off-black not pure black. Phosphor duotone icons. Show-don't-tell: give feature/
step cards a real mini-preview of the product, not just text. Screenshot it
(headless) and show me before committing.
```

### 5.3 Polish pass
```
Run make-interfaces-feel-better over <files>: concentric radii, shadow-as-border,
text-wrap balance on headings + pretty on body, tabular-nums on dynamic numbers,
active:scale-[0.96] on buttons, kill every transition:all, focus-visible rings,
40x40 hit areas. Present changes as a before/after table.
```

### 5.4 Motion
```
Use gsap-scrolltrigger. Add ONE motivated scroll effect (a reveal that tells a
story), with useGSAP() cleanup and a prefers-reduced-motion fallback. No
scroll-hijacking, no random-scatter on a serious/B2B page. Motion must be
motivated, not decoration.
```

### 5.5 Dashboard / data page
```
This is an OPERATIONAL dashboard. Apply: traffic-light rule (red ONLY when
broken — no red zeros at idle), F-pattern (critical signal top-left),
progressive disclosure (summary → drill-down), a plain-language insight line,
sparklines over big charts, bars over pie, filterable dense table, sticky
headers, minimal padding. Design a real empty/idle state that PREVIEWS what will
populate — never an empty table.
```

### 5.6 Research before building
```
Before building <page>, pull real references: use the Refero MCP (or the
refero.design taxonomy) for "<page-type>" + "<flow>", and name the closest
uiverse design-system family to our aesthetic. Summarize the 3-5 concrete
layout/interaction decisions worth borrowing, then build in OUR tokens.
```

### 5.7 Fix "it looks basic / AI-generated"
```
This looks generic. Diagnose against design-taste-frontend's AI-tells list and
name the specific offenders (flat cards, one-column stack, generic blue,
screaming zeros, empty void, thin icons). Then rethink the LAYOUT (bento / split-
pane / flat-terminal / focused-flow — pick what fits), not just the colors. Show
old vs new before committing.
```

---

## 6. Pre-flight checklist — run before every commit

- [ ] `grep -rn "—\|–"` in visible strings → **0** (em-dash ban)
- [ ] Eyebrows ≤ `ceil(sections / 3)`; no `01/02/03` number labels
- [ ] ONE accent color; semantic colors only where they mean something
- [ ] No pure `#000000` / `#ffffff` surfaces
- [ ] `transition:all` → specific properties; `focus-visible` rings present
- [ ] Headings `text-balance`, body `text-pretty`, dynamic numbers `tabular-nums`
- [ ] `prefers-reduced-motion` respected on every animation
- [ ] Empty / loading / error states designed (not just the happy path)
- [ ] Typecheck clean + build succeeds + a headless screenshot was reviewed

---

*Toolkit skills: ui-ux-pro-max · design-taste-frontend · make-interfaces-feel-better
· gsap-scrolltrigger. Reference sites: refero.design · uiverse.io · checklist.design.
Portable — reuse across any project.*
