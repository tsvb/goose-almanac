# Design — Experience Modes

_Date: 2026-06-27 · Status: approved — ready for implementation plan_

## Summary

Let each visitor choose **how** they experience the Goose Almanac, from three
presentations of the **same content and routes**:

1. **Fancy** — the current immersive "Almanac" design (the showcase). _Default._
2. **Functional** — a dense, utility-first surface for scanning data fast.
3. **Minimal** — bare semantic content with embedded structured data, fast and
   trivially machine-readable.

Nothing about the data, features, or URLs changes between modes — only the
presentation. This keeps every show, stat, and page reachable in all three.

## Decisions (confirmed with Tim)

- **Default mode:** Fancy, for a strong public first impression.
- **Machine-readable means:** clean semantic HTML **plus** embedded `schema.org`
  JSON-LD — one page serves humans and machines. (Not separate `.json`/`.txt`
  endpoints; see Non-goals.)
- **Light/dark stays a separate axis,** available where it makes sense (Fancy,
  Functional). Minimal is a single high-contrast look (its theme toggle is
  hidden).
- **Names:** user-facing labels are **Fancy · Functional · Minimal** — direct and
  to the point — matching the internal keys.

## Goals

- A persistent, per-visitor **experience mode** selectable from the header.
- Three genuinely distinct presentations that share one data layer.
- JSON-LD structured data on content pages, in every mode (SEO + assistants +
  accessibility).
- No regression to the existing dark/light theming or any current route.

## Non-goals

- Separate machine endpoints / content negotiation (`/shows/X.json`). Possible
  future; explicitly out of scope now.
- Per-user accounts or server-stored preferences (a cookie is enough).
- Re-skinning _every_ listing with bespoke per-mode markup in v1 (see Scope).

## The three modes

| | Fancy | Functional | Minimal |
|---|---|---|---|
| Intent | Savor / showcase | Scan / dig stats | Read fast / machines |
| Type | Fraunces serif display | Sans, compact | System font |
| Setlist | Segue-thread rails, jam flames, track-time ledger, "from the notes" | Sortable/filterable table (Set · # · Song · → · Time · Jam) + totals | Semantic `<h2>`/`<ol>`, inline ` > `, `(time)`, `· jam` |
| Ornament | Grain, motion, gold accents | None | None |
| Density | Spacious | Tight | Tight, content-first |
| Light/dark | Both | Both | Single look |
| JSON-LD | Present (hidden) | Present (hidden) | Present + surfaced via `<details>` |

The interactive mockup approved on 2026-06-27 demonstrates all three on a show page.

## Selection & persistence

- Mode lives in a cookie `ga_experience` with values `fancy | functional |
  minimal` (default `fancy` when absent/invalid).
- Because modes change **markup** (not just colors), mode is resolved
  **server-side** from the cookie and the correct HTML is rendered per request.
  The app is already `force-dynamic`, so this adds no caching complexity and
  produces **no flash** (unlike the client-applied light/dark theme).
- A server helper `getExperience()` reads the cookie via `next/headers`'
  `cookies()` and returns a validated `Experience`.
- `data-experience="<mode>"` is set on `<html>` in `app/layout.tsx` (mirroring
  the existing `data-theme`) so global CSS can react.
- **Switcher:** a client component in `SiteHeader`, beside the theme toggle. On
  change it writes the cookie and calls `router.refresh()` so the server
  re-renders markup for the new mode. In Minimal, the light/dark toggle is hidden.

This is orthogonal to light/dark: e.g. Fancy + dark, Functional + light, etc.

## Machine-readable layer (JSON-LD)

- A server component `<JsonLd data={…} />` emits
  `<script type="application/ld+json">` and renders in **all** modes (invisible).
- Schema mapping:
  - Show page → `MusicEvent` (name, `startDate`, `location` as `Place`/
    `MusicVenue`, `performer` as `MusicGroup`, `workPerformed` as the setlist's
    `MusicComposition`s in order).
  - Listings (shows/venues/tours/years) → `ItemList` + `BreadcrumbList`.
  - Site root → `MusicGroup` (Goose) + `WebSite`.
- Minimal mode also surfaces the same JSON-LD to humans via a collapsed
  `<details>` (transparency; nice for the curious and for scrapers).

## Architecture

A **presentation layer** over the existing data/query layer. No query changes.

1. **`lib/experience.ts`** — `Experience` type, `EXPERIENCES` metadata
   (key, label, description, Tabler icon, `allowsTheme`), `getExperience()`
   (cookie read + validate), `experienceLabel()`.
2. **Global CSS layers** in `app/globals.css`:
   - Fancy = today's tokens (unchanged default).
   - `[data-experience="functional"]` — denser spacing scale, sans display font,
     disable `.grain-overlay` and `.rise` motion, tighter line-height.
   - `[data-experience="minimal"]` — system font, neutral palette, remove all
     decoration, generous reading measure.
   These cover generic page chrome/typography automatically across every route.
3. **Signature components get mode-aware variants** (the surfaces where markup
   genuinely differs):
   - `app/_components/setlist.tsx` → split into `SetlistFancy` (current),
     `SetlistTable` (functional), `SetlistPlain` (minimal), behind a `Setlist`
     wrapper that selects on `getExperience()`.
   - The **Shows browse** list (`ShowRow`/`ShowCard`) → card grid (Fancy),
     dense table rows (Functional), plain semantic list (Minimal).
4. **`<JsonLd>`** server component + small per-page builder helpers in
   `lib/queries/format.ts` (or a new `lib/jsonld.ts`).
5. **`ExperienceSwitcher`** client component; `SiteHeader` updated to host it and
   to hide the theme toggle in Minimal.

Other listing pages (venues/tours/years/search/on-this-day) inherit the global
CSS treatment in v1 and render semantic markup for Minimal; bespoke per-mode
variants for those are a fast-follow, not a blocker.

## Accessibility & SEO

- Minimal guarantees one `<h1>`, sectioned `<h2>`, ordered lists, and landmark
  regions — already screen-reader-excellent.
- JSON-LD improves search/assistant comprehension in all modes.
- The switcher is keyboard-operable with clear active state and `aria` labels.

## Testing (vitest + PGlite, offline)

- `getExperience()` — default, each valid value, invalid → default.
- Setlist render per mode: Fancy emits flame/segue markup; Functional emits a
  `<table>` with the right columns; Minimal emits `<ol>` and no decorative
  classes.
- `<JsonLd>` for a show emits valid `MusicEvent` JSON containing the venue and
  the setlist songs in order.
- Minimal show page exposes exactly one `<h1>` and ordered-list setlist.
- All existing tests stay green; production build passes.

## Naming (decided)

User-facing labels match the internal keys: **Fancy · Functional · Minimal** —
direct and to the point. Cookie values and `Experience` keys are
`fancy | functional | minimal`.

## Risks

- **Scope across listings.** Mitigated by the global-CSS-first approach + only
  two bespoke signature variants in v1.
- **Switch re-render.** `router.refresh()` re-fetches a dynamic page; fine at
  this traffic and already how the site renders.
- **Cookie vs CDN.** Pages are dynamic (per-request), so no cross-mode cache
  bleed.

## Build phases (for the plan)

1. `experience.ts` + cookie wiring + `data-experience` on `<html>` (Fancy still
   the only visible look). Tests for resolution.
2. `ExperienceSwitcher` in the header + Minimal hides theme toggle.
3. Global CSS for Functional and Minimal.
4. `Setlist` variants (Fancy/Table/Plain) + tests.
5. Shows-browse variants.
6. `<JsonLd>` across content pages + tests.
7. Polish pass + full verify + deploy.
