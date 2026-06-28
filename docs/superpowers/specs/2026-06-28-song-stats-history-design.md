# Phase 2 — Song Stats & History

_Date: 2026-06-28 · Status: design (awaiting review) · Builds on Phase 1 (show browsing) and the Experience-Modes work._

## Goal

Turn every song into a destination. Phase 2 lights up the plain-text song names
in setlists as links to a **per-song page** rich with stats and history, adds a
**sortable song index** that doubles as the catalog leaderboard, and a **`/stats`
hub** of curated cuts. Everything is computed from data already in the database —
no new data source. (Spotify studio discography is explicitly **out of scope**,
deferred to a later Phase 2.5.)

## Guiding principle (Tim's steer)

**Content density over decoration.** Visuals must *carry information* — bar
charts, sparklines, dense tables — not decorate. Compress heroes, surface the
numbers immediately, pack the screen. This is the through-line for every page
below. The validated mockups live in `.superpowers/brainstorm/` (song page,
dense song page, song index, mobile).

## Responsive contract (hard requirement)

Every dense view MUST hold up at **360px** with no text sprawl and no smooshing.
Three rules, validated visually and required of all Phase 2 pages:

1. **Fact ribbons reflow** to a tidy 2-up grid; each value sits in its own cell
   and never wraps mid-text.
2. **Dense tables pin + scroll.** The identity column (song name / date) is
   `position: sticky; left: 0`; the remaining columns keep their real widths and
   scroll horizontally inside an `overflow-x:auto` wrapper under a soft right-edge
   fade with a "swipe →" cue. No column is hidden; nothing wraps to a second line.
3. **Two-column layouts collapse to one.** The song page's charts rail stacks
   above the performance log; every chart goes full width.

## The stats — precise definitions

All derived, never hand-entered. The nightly sync recomputes everything, so a new
show or a crossed threshold surfaces automatically the next morning.

**Show sequence.** Number every *played* Goose show (`show_date <= current_date`,
has performances) by `(show_date, show_order)` ascending → `show_seq`. All gap math
is expressed in this sequence so it counts shows, not days.

- **Times played** — count of performances of the song.
- **Debut** — earliest performance (date + venue).
- **Last played** — most recent performance (date + venue).
- **Rotation %** — `times_played / total_shows_since_debut`. How much of the band's
  life since the song appeared has included it.
- **Gap (per performance)** — number of shows strictly between this performance and
  the song's previous performance: `show_seq − prev_show_seq − 1`. Back-to-back
  shows = gap 0. Debut performance has no gap.
- **Current gap** — shows since last played: `max(show_seq) − last_perf_show_seq`.
- **Longest gap / average gap** — max and mean of the per-performance gaps.
- **Longest versions** — top performances by parsed `track_time` (`trackSeconds`).
- **Set placement** — share of performances by `set_type`/`set_number`: Set 1,
  Set 2, Encore; plus "show opener" (position 1 of the first set) and "jammed"
  (`is_jam` or 10-min+). Rendered as labeled bars.
- **Plays per year** — count grouped by `year(show_date)`; the signature
  content-rich visual (a small bar chart, and a per-row sparkline in the index).

### "Dusted Off" — the long-gap return

A performance is **Dusted Off** when its gap is unusually large *for that song*:

> gap ≥ the song's **95th-percentile** gap **AND** gap ≥ **15** shows (absolute floor).

The percentile makes it relative to each song's own rhythm; the floor stops a
heavy-rotation song from "returning" after a normal short gap. Both are pure
computations over the gap series.

- **Label is a single constant** `RETURN_LABEL = "Dusted Off"` (display string only;
  trivial to rename). The marker always pairs the label with the hard number, e.g.
  `Dusted Off · 52 shows`.
- Surfaces in three places, all automatic: the song page's performance log (row
  flagged), the **show-page setlist** (inline marker next to the song that night),
  and a `/stats` cut ("recently dusted off").

## Page set & per-mode rendering

Per-mode strategy mirrors Phase 1: a `minimal` branch renders a plain semantic
**document** (no charts — same numbers as tables), while **Fancy and Functional
share one dense body** reskinned by the existing `[data-experience="functional"]`
Web 2.0 CSS layer. Charts/sparklines render only in Fancy & Functional.

### 1. `/songs` — the song index (sortable master list = leaderboard)

One dense, sortable table of all ~614 songs. Columns: rank, song (→ song page),
**Played**, **Activity ’17–now** (per-row plays-per-year sparkline), Rotation %,
**Gap** (orange when overdue), Last played, Debut. Controls: a filter box, an
Originals/Covers facet, and sort chips — **Most played · Rarest · Most overdue ·
Recently played · By debut · A–Z**. Re-sorting turns the same table into each
leaderboard. Minimal: the same columns as a plain table, no sparkline (or a text
sparkline is explicitly *not* used — plain numbers).

### 2. `/songs/[slug]` — the song page

- **Compact hero:** title + Original/Cover tag, one line.
- **Fact ribbon:** Times Played · Rotation · Current Gap · Avg Gap · Longest Gap ·
  Debut · Last Played · Longest — one dense strip (2-up grid on mobile).
- **Charts rail (left) + performance log (right)** on desktop; stacks on mobile.
  Rail: Plays per year (bar chart), Set placement (bars), Gap history (sparkline,
  Dusted-Off returns highlighted), Longest versions (mini-list), Top venues.
- **Every performance:** full chronological log (newest first, paginated) with
  date → show, venue/city, set, position, **gap**, track time, jam flag, and the
  **Dusted Off** marker on qualifying rows.
- Minimal: hero h1 + a `MetaTable` of the ribbon facts + semantic tables for
  plays-per-year, set placement, longest versions, and the full performance log.

### 3. `/stats` — the hub + five cuts

A hub landing that links the five pages (each with a teaser number), then:

- **`/stats/most-played`** — top of the catalog by play count (a bar chart of the
  top ~25 + the ranked table).
- **`/stats/rarities`** — the rare gems: songs played 1–3 times, sorted fewest-first
  (one-timers surfaced), with debut/last/who-it's-by.
- **`/stats/current-gaps`** — **Most Overdue.** Active-rotation songs (played ≥ 5×,
  or seen within ~2 years) with the largest current gaps. Distinct from Rarities:
  these are songs the band *plays* but hasn't lately. Pure one-timers stay on
  Rarities, not here.
- **`/stats/debuts`** — debuts by year (count chart) and a recent-debuts list; the
  "what's new" view.
- **`/stats/set-stats`** — site-wide placement: most common show openers, set-1
  openers, set-2 openers, encores, and closers, from `position`/`set_*` data.

### Chrome

- **Nav:** add **Songs** and **Stats** to all three `SiteHeader` variants
  (Fancy/Functional/Minimal) and the footer where appropriate.
- **Setlist links:** every setlist variant (`fancy`/`functional`/`minimal`) wraps
  the song name in a link to its song page when a slug exists, and renders the
  Dusted-Off inline marker.

## Data & code layer

- **New:** `lib/queries/songs.ts` — the song-stats query module:
  - `listSongs(opts: { sort; facet?; q? }): Promise<SongRow[]>` — index rows
    (id, name, slug, isOriginal, playCount, rotation, currentGap, lastPlayed,
    debutYear, playsPerYear: number[]).
  - `getSongBySlug(slug): Promise<SongDetail | null>` — meta + all headline stats +
    set-placement + plays-per-year + longest versions + top venues.
  - `getSongPerformances(songId): Promise<SongPerf[]>` — full log with per-row
    `gap` and `isDustedOff`.
  - Stats-hub helpers: `mostPlayed`, `rarities`, `currentGaps`, `debutsByYear` +
    `recentDebuts`, `setStats`.
  - A shared **show-sequence CTE** + window functions (`lag`, `percentile_cont`)
    underpin the gap math; co-locate the SQL so the definition lives in one place.
- **Extend:** `getSetlist` (in `lib/queries/shows.ts`) so `SetlistEntry` gains
  `gap: number | null` and `isDustedOff: boolean`, computed for the show's songs.
- **Helpers:** add `songHref(song)` and a `RETURN_LABEL` constant to
  `lib/queries/format.ts` (or a small `lib/songs.ts`). Reuse existing `trackSeconds`,
  `formatDuration`, `showHref`, date helpers.
- **Components:** new `app/_components/song/*` (fact ribbon, plays-per-year chart,
  set-placement bars, gap sparkline, dense performance table, sortable index table)
  shared by Fancy/Functional; Minimal reuses `Doc`/`MetaTable`/`DocSection` plus a
  couple of new semantic-table primitives.
- **Routes:** `app/songs/page.tsx`, `app/songs/[slug]/page.tsx`, `app/stats/page.tsx`,
  `app/stats/[cut]/page.tsx` (or one folder per cut). All `force-dynamic` like Phase 1,
  with `generateMetadata` and invalid-slug `notFound()`.

### Slug prerequisite

Song URLs are slug-based. `songs.slug` comes from elgoose but **may be null/empty
for some songs**. Before shipping, backfill a stable, unique slug for every song
(derive from name, de-duplicate with a numeric suffix), so every song has one
canonical URL. `getSongBySlug` resolves by slug; add a guard for collisions.

## Testing

Follow existing patterns — PGlite query tests + `renderToStaticMarkup` component
tests.

- **Gap math unit tests** with fixtures: a song played at show_seq 1, 3, 8 → gaps
  [—, 1, 4]; current gap against the latest show; longest/avg.
- **Dusted-Off** tests: a heavy-rotation song's normal gap does *not* qualify; a
  return past the 95th percentile and ≥15 floor does.
- **listSongs** sort/facet tests (most-played order, rarest, overdue excludes
  one-timers, originals/covers facet).
- **current-gaps** excludes pure rarities; **rarities** includes one-timers.
- Component render tests for the index table, fact ribbon, and a Dusted-Off marker.
- Responsive contract is verified manually at 360px (pin+scroll, ribbon reflow,
  column collapse) — noted in the plan as a check/verify step, not a unit test.

## Scope & risk

- **In:** song index, song page, `/stats` hub + five cuts, setlist links +
  Dusted-Off markers, nav, slug backfill — all from existing data.
- **Out (deferred):** Spotify studio discography (new source/auth) → Phase 2.5;
  venue lat/lng map; nugs deep-links; OG share images.
- **Risk:** the gap/percentile SQL is the fragile part — isolate it behind the
  query module and cover it with fixture tests so the +/−1 convention and the
  Dusted-Off threshold are pinned. Index page over ~614 rows is fine to render
  server-side; sort/filter are server params (no client data table needed), with
  optional progressive client enhancement later (YAGNI for now).

## Build

Subagent-driven on a branch, in dependency order: (1) gap/stats query module +
fixture tests; (2) slug backfill; (3) `/songs` index; (4) `/songs/[slug]` page;
(5) `/stats` hub + cuts; (6) setlist links + Dusted-Off markers + nav; (7) verify
(typecheck, tests, 360px responsive pass) + ship.
