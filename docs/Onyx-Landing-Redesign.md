# Onyx — Landing / Marketing Site Redesign (T21)

*Turns the thin flat-nav SPA into a credible product site that advertises everything shipped through Phase 5 (auth scanning, OWASP coverage, evidence-based findings, CLI + GitHub Action). Build-focused.*

Last updated: July 2026

---

## Decisions locked

- **Positioning:** product/SaaS voice, with an honest "built by a solo founder, improving in the open" note on About/footer. Doesn't commit to startup-vs-indie; keeps both open.
- **SEO/framework:** stay a Vite React SPA; add `react-helmet-async` for per-route meta + a prerender/SSG step for public routes + `sitemap.xml`. No framework migration. Rationale: real HTML for crawlers + social unfurls with no rewrite and one codebase.
- **Scope this pass:** nav mega-menu + new homepage sections + new standalone pages (Pricing, Security, Changelog) + legal pages + product-proof demo.

---

## New information architecture (navbar mega-menu)

Desktop nav, left → right. Dropdowns are two-column panels with a short description per item (competitor pattern), styled light-mono.

- **Logo** → `/`
- **Product ▾**
  - How it works → `/#how-it-works`
  - Authenticated scanning → `/#authenticated`
  - OWASP API Top 10 coverage → `/#owasp`
  - Live console (watch it attack) → `/#demo`
  - CLI & CI/CD → `/#cicd`
- **Solutions ▾**
  - Shift-left in CI/CD → `/#cicd`
  - API security coverage → `/#owasp`
  - For developers → `/#authenticated`
  - For security teams → `/security`
- **Resources ▾**
  - Docs → `/docs`
  - Changelog → `/changelog`
  - OWASP API Top 10 guide → `/docs` (dedicated section)
  - GitHub → external
- **Pricing** → `/pricing` (new standalone route; keep `/#pricing` anchor working/redirecting)
- **Right side:** Sign In → `/signin` · **Start free scan** → `/signup`
- **Mobile:** hamburger → full-width panel with collapsible groups mirroring the dropdowns.

Note: Solutions/Product items mostly deep-link to homepage anchors (no page sprawl); only Pricing, Security, and Changelog become real new routes now.

---

## Page map

**Build now (this pass):**

| Route | Status | Ticket |
|---|---|---|
| `/` (homepage) | exists — add 4 new sections | T21b, T21c |
| `/pricing` | NEW standalone (from the anchor) | T21d |
| `/security` | NEW trust/security page | T21e |
| `/changelog` | NEW (render from `docs/UPDATES.md`) | T21f |
| `/privacy`, `/terms`, `/responsible-disclosure` | NEW legal pages | T21g |
| nav mega-menu + route stubs | NEW | T21a |
| per-route SEO + prerender + sitemap | NEW | T21h |
| repo hygiene (dead components, font config) | cleanup | T21i |

**Defer:** Blog/content hub, per-role Solutions pages, testimonials/case studies (need real customers), SSR migration.

---

## Homepage section order (existing + new)

1. **Hero** (keep). Verify the `{ }` headline reads as "Break your API before they do." Tighten subhead to include the new depth (below).
2. **TrustStrip** (update stats): "8 attack types · authenticated scanning · OWASP API Top 10 · live streaming."
3. **PoweredBy** logo marquee (keep).
4. **AboutSection** "Never miss a vuln" (keep).
5. **HowItWorks** (keep; optionally add a "baseline + confirm" step to reflect T5/T6).
6. **NEW — Authenticated scanning** (`#authenticated`).
7. **NEW — OWASP API Top 10 coverage** (`#owasp`).
8. **NEW — CI/CD shift-left** (`#cicd`) with a CLI snippet + GitHub Action.
9. **NEW — Product proof / live console replay** (`#demo`) + a sample report visual.
10. **FeatureShowcase** (keep).
11. **MoreFeatures** (keep).
12. **Pricing teaser** (keep; CTA → `/pricing`).
13. **FaqCta** (keep).
14. **Footer** (update: product voice, add Security + legal links; keep an honest builder note).

---

## Copy for the new sections (use verbatim in build prompts)

**6. Authenticated scanning — `#authenticated`**
- Eyebrow: `AUTHENTICATED TESTING`
- Headline: **Test what's behind the login.**
- Sub: "Most real API risk lives behind auth. Onyx logs in with a bearer token, API key, cookie, OAuth2 client-credentials, or a full login flow — then attacks the endpoints that actually matter. It even strips auth on purpose to prove your access controls hold."
- Bullets: Static tokens & API keys · OAuth2 & login flows with auto-refresh · Encrypted at rest, never logged · Missing-auth probes to catch broken access control.

**7. OWASP API Top 10 coverage — `#owasp`**
- Eyebrow: `OWASP API TOP 10`
- Headline: **Every finding, named.**
- Sub: "From injection to broken authentication to resource exhaustion, every result is mapped to the OWASP API Security Top 10 (2023) — API1 through API10 — with a coverage matrix in every report and PDF export."
- Visual: a compact API1–API10 grid with example categories lit up.

**8. CI/CD shift-left — `#cicd`**
- Eyebrow: `SHIFT LEFT`
- Headline: **Break the build before attackers break in.**
- Sub: "Run Onyx in CI with one command or drop in our GitHub Action. Fail the PR on criticals, comment findings inline, and ship SARIF straight to your GitHub Security tab."
- Code block:
  ```
  onyx scan --spec ./openapi.json --fail-on high --format sarif
  ```
- Bullets: One-line CLI (table/JSON/SARIF) · GitHub Action with PR comments · SARIF → Security tab · Exit-code gating for any CI.

**9. Product proof / live console — `#demo`**
- Eyebrow: `SEE IT WORK`
- Headline: **Watch it attack, live.**
- Sub: "Every payload streams back in real time — method, status, latency — and lands as a confirmed finding with the exact evidence and the fix. Here's a replay."
- Visual: a canned, auto-playing replay of the streaming console (reuse `ChaosStream` + a curated fixture) and a real sample-report snapshot.

**Hero subhead refresh (option to swap in):**
"Onyx reads your OpenAPI spec, logs in, fires schema-aware attacks at every endpoint, and streams back confirmed findings — with the evidence and the fix — live."

---

## Ticket sequence (landing)

- **T21a — Navbar mega-menu + route stubs + mobile.** Dropdowns (Product/Solutions/Resources), Pricing route, Sign in / Start free; add lazy route stubs for `/pricing`, `/security`, `/changelog`, `/privacy`, `/terms`, `/responsible-disclosure` (minimal but presentable) so no dropdown link 404s. Keep `/#pricing` working.
- **T21b — Homepage: Authenticated scanning + OWASP coverage sections.**
- **T21c — Homepage: CI/CD shift-left + product-proof console replay + sample report.**
- **T21d — Standalone Pricing page** (flesh out the stub: tiers, comparison, FAQ, CTA).
- **T21e — Security/Trust page** (SSRF posture, domain verification, secret handling, data handling, SOC 2 "in progress", responsible-disclosure pointer).
- **T21f — Changelog page** (render curated entries from `docs/UPDATES.md`).
- **T21g — Legal pages** (Privacy, Terms, Responsible Disclosure — real content; note: get a lawyer to review before relying on them).
- **T21h — SEO**: `react-helmet-async` per-route meta + prerender/SSG for public routes + `sitemap.xml` + canonical/og:url + set production domain.
- **T21i — Repo hygiene**: remove dead dark-theme components (SupportedTech, MetricsRow, legacy Pipeline, orphaned `landing-page.html`, unused `pages/LandingPage/`, unused Lottie files) and fix the Geist-vs-Inter/Satoshi tailwind config inconsistency. ASK before deleting anything.

Same rhythm as the build tickets: one prompt at a time, each ends with a SUMMARY block, you paste it back, I verify, then next.

---

## Notes / suggestions beyond structure

- **Biggest credibility win = product proof.** The WebGL art is pretty but shows nothing the product does. The canned console replay (T21c) + a real annotated report screenshot/PDF will carry more weight than any hero animation.
- **Trust before features** for security buyers — the `/security` page (T21e) matters more here than for a generic SaaS.
- **Legal pages help conversion**, especially with Razorpay/INR billing (refund/contact expectations).
- **Standalone `/pricing`** helps SEO + ads + direct links (an anchor can't be linked or ranked well).
- Keep the clever `{ }` hero but sanity-check legibility on mobile; alternatives on hand if it reads as a broken glyph.
