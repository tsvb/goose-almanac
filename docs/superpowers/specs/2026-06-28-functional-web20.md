# Functional as Web 2.0 (addendum)

_Date: 2026-06-28 · Status: built 2026-06-28 · Builds on `2026-06-27-experience-modes-divergence.md`_

## Decision (confirmed with Tim)

The **Functional** mode is reskinned in mid-2000s **Web 2.0** style on **every page**:
glossy gel buttons, rounded gradient panels with soft drop shadows, zebra-striped
tables with gradient header rows, glossy badges, a "BETA" star, a gradient app-bar
header, bold Helvetica type, a saturated **sky-blue** accent, on a light gradient
background. (Replaces the current flat steel "tool" look.)

## Design tokens (Functional Web 2.0)

- **Palette (single-look light, ignores `data-theme`):** page bg `linear-gradient(#eef5fb,#d6e6f4)`; surfaces white→`#f1f7fc`; ink `#2a3a47`, sub `#5f7282`; accent blue `#2f86cf` (gel gradient `#5aa9e6→#2f86cf`); hairlines `#c4d4e2`; jam gold `#f4a72b`.
- **Type:** `"Helvetica Neue", Helvetica, Arial, "Lucida Grande", sans-serif`, bold headings.
- **Surfaces:** rounded `12px`, white→pale-blue gradient, `1px #c4d4e2` border, `box-shadow: 0 1px 4px rgba(40,70,110,.18)`.
- **Buttons (gel):** rounded `8px`, blue gradient, inset white highlight + drop shadow, white bold text with dark text-shadow.
- **Tables:** gradient blue header row (white bold uppercase); zebra rows (`#eef5fb` even); hover `#fff7e0`.
- **Badges:** rounded pills, pale-blue gradient (gold variant for duration); jam = a `★ JAM` gold badge.
- Functional becomes **single-look** → `allowsTheme("functional")` returns false; the header theme toggle disappears (only Fancy keeps dark/light).

## Implementation strategy

Mostly **CSS**, since the functional listing/home bodies currently render the Fancy
body markup (shared `.surface-card`, `.eyebrow`, `.link`, button patterns, `ShowRow`
lists). A `[data-experience="functional"]` CSS layer reskins those at once:
- page bg gradient; the Web 2.0 palette + Helvetica type tokens;
- `.surface-card` → glossy gradient rounded panel + shadow;
- `.eyebrow` → Web 2.0 label; `.stage-glow` already off;
- the common rounded-border `Link`/button pattern → gel;
- `.surface-card` `<li>` lists + tables → zebra rows + gradient headers.

Plus bespoke Web 2.0 for the functional-only components:
- `HeaderFunctional` → gradient **app bar** (bold wordmark + `BETA` star + nav pills + gel switcher);
- `FooterFunctional` → Web 2.0 footer bar;
- `ShowHeader` functional branch → glossy panel + glossy **stat badges**;
- `SetlistFunctional` → zebra table + gradient header + `★ JAM` badges + gel toolbar controls.

## Scope & risk

All functional pages. Risk: CSS overriding Tailwind-utility markup on the listing
pages is the fragile part — target the custom classes (`.surface-card`, `.eyebrow`)
and the common button patterns; accept minor imperfection on incidental buttons and
refine after a visual pass. The show page + chrome are bespoke and exact.

## Build

Subagent flow on a branch: (1) Functional Web 2.0 CSS foundation + `allowsTheme`
change + test; (2) header app-bar + footer; (3) show-header glossy panel + badges;
(4) setlist zebra table + gel toolbar; (5) verify + ship.
