# Phase 2 — Song Stats & History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn every song into a destination — a per-song stats page, a sortable song index, a `/stats` hub, "Dusted Off" long-gap returns flagged inline in setlists, and song-name links throughout — all computed from existing data, in all three experience modes.

**Architecture:** A new `lib/queries/songs.ts` owns all stat computation (a show-sequence CTE + window functions for gaps; percentiles for "Dusted Off"). Markup lives in shared `app/_components/song/*` components so the page files stay thin; pages branch `if (experience === "minimal")` for the semantic-document version while Fancy/Functional share one dense body reskinned by `[data-experience="functional"]` CSS. Routes are `force-dynamic` server components like Phase 1.

**Tech Stack:** Next.js 15 App Router (async server components), Drizzle + postgres.js + `sql` template, Tailwind v4 CSS-var tokens, Vitest + PGlite (query tests) + `renderToStaticMarkup` (component tests).

## Global Constraints

- **Density over decoration.** Visuals must carry information (charts, sparklines, dense tables); compress heroes, surface numbers first. (Spec: "Guiding principle".)
- **Responsive contract — hard requirement, verified at 360px:** (1) fact ribbons reflow to a 2-up grid, each value in its own cell, never wrapping mid-text; (2) dense tables pin the identity column (`position:sticky; left:0`) and horizontally scroll the rest inside `overflow-x:auto` under a right-edge fade with a "swipe →" cue — no column hidden, nothing wraps to a second line; (3) two-column layouts collapse to one (charts rail stacks above the log, charts full-width).
- **Minimal = plain semantic tables, no charts/sparklines.** Charts render only in Fancy & Functional. Minimal shows the same numbers as `<table>`s.
- **Fancy & Functional share one dense body**, reskinned via the existing `[data-experience="functional"]` Web 2.0 CSS layer. Only `minimal` gets a separate branch.
- **"Dusted Off"** = a performance whose gap ≥ that song's 95th-percentile gap **AND** ≥ **15** shows (absolute floor). Display label is the single constant `RETURN_LABEL = "Dusted Off"`; markers always pair the label with the number (`Dusted Off · 52 shows`).
- **Gap definitions (verbatim):** number the *played* shows (`show_date <= current_date`, has performances) by `(show_date, show_order)` → `show_seq`. **Gap (per performance)** = `show_seq − prev_show_seq − 1` over distinct (song, show); back-to-back = 0; debut has no gap. **Current gap** = `max(show_seq) − last_perf_show_seq`. **Rotation %** = `times_played / shows_since_debut`.
- **"Most overdue" (`/stats/current-gaps`) is active-rotation only** (played ≥ 5×); pure one-timers live on **Rarities**, not here.
- Routes use `export const dynamic = "force-dynamic"`, `generateMetadata`, and `notFound()` on invalid/missing params (Phase 1 convention).
- **Out of scope:** Spotify discography (Phase 2.5), venue map, nugs links, OG images.
- Commit after every green step. Run `npm test` and `npm run typecheck` before declaring a task done. **Never run `npm run build` while `npm run dev` is running.**

---

## File Structure

**New files**
- `lib/queries/songs.ts` — all song-stat queries + types + the gap/Dusted-Off logic.
- `lib/queries/songs.test.ts` — fixture tests for gaps, Dusted Off, sorts, stats cuts.
- `db/slugs.ts` — `ensureSongSlugs(db)` backfill (idempotent, dedupe).
- `db/slugs.test.ts` — backfill tests.
- `scripts/backfill-slugs.ts` — one-shot runner for production.
- `app/_components/song/ribbon.tsx` — `FactRibbon` (dense fact strip, reflows on mobile).
- `app/_components/song/charts.tsx` — `PlaysPerYearChart`, `SetPlacementBars`, `GapSparkline`, `MiniSparkline`.
- `app/_components/song/perf-table.tsx` — `PerformanceTable` (pin+scroll dense log).
- `app/_components/song/index-table.tsx` — `SongIndexTable` (sortable master list, pin+scroll).
- `app/_components/song/scroll-table.tsx` — `ScrollTable` wrapper (overflow-x + fade + swipe cue).
- `app/_components/song/index.ts` — barrel re-exports for the above.
- `app/songs/page.tsx` — song index (3 modes).
- `app/songs/[slug]/page.tsx` — song page (3 modes).
- `app/stats/page.tsx` — stats hub landing.
- `app/stats/[cut]/page.tsx` — the five cuts (3 modes).
- `app/_components/song/index-table.test.tsx`, `app/_components/song/perf-table.test.tsx` — render tests.

**Modified files**
- `lib/queries/format.ts` — add `songHref`, `RETURN_LABEL`, `slugifySongName`.
- `lib/queries/shows.ts` — extend `SetlistEntry` with `gap`/`isDustedOff`; enrich in `getSetlist`.
- `app/_components/setlist/{fancy,functional,minimal}.tsx` — link song names + render Dusted-Off marker.
- `app/_components/setlist/fancy.test.tsx` (+ new marker assertions) — and minimal/functional tests.
- `app/_components/site-header.tsx`, `app/_components/site-footer.tsx`, `app/_components/mobile-nav.tsx` — add Songs + Stats nav.
- `lib/sync/run.ts` (the sync orchestrator) — call `ensureSongSlugs` after song upsert.
- `app/globals.css` — song/stats classes, responsive pin+scroll/ribbon rules, Functional reskin.

---

## Task 1: Song stats core — show-sequence, gaps, Dusted Off, song page data

**Files:**
- Create: `lib/queries/songs.ts`
- Create: `lib/queries/songs.test.ts`

**Interfaces:**
- Consumes: `db` from `@/db/client`; `sql` from `drizzle-orm`; `setLabel` from `@/app/_components/setlist/shared`; `trackSeconds` from `@/lib/queries/format`.
- Produces:
  - `p95(values: number[]): number` — nearest-rank 95th percentile (0 for empty).
  - `isDustedOffGap(gap: number | null, songGaps: number[]): boolean` — `gap != null && gap >= 15 && gap >= p95(songGaps)`.
  - `type SongPerf` (fields below) and `getSongPerformances(songId: number): Promise<SongPerf[]>`.
  - `type SongStat` and `getSongBySlug(slug: string): Promise<SongStat | null>`.

**Reference:** raw-SQL normalize pattern in `lib/queries/stats.ts` (the `firstRow` helper). Add an `allRows` sibling here.

- [ ] **Step 1: Write failing tests for `p95` and `isDustedOffGap`**

Create `lib/queries/songs.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { makeTestDb } from "@/db/testing";
import {
  upsertArtists, upsertVenues, upsertTours, upsertSongs, upsertShows, upsertPerformances,
} from "@/db/repository";
import { p95, isDustedOffGap } from "./songs";

describe("p95 / Dusted Off helpers", () => {
  it("p95 nearest-rank", () => {
    expect(p95([])).toBe(0);
    expect(p95([5])).toBe(5);
    // 20 values 1..20 -> nearest-rank index floor(0.95*19)=18 -> value 19
    expect(p95(Array.from({ length: 20 }, (_, i) => i + 1))).toBe(19);
  });
  it("isDustedOffGap needs both the floor and the percentile", () => {
    const gaps = [0, 1, 1, 2, 0, 1, 60]; // p95 ~ 60
    expect(isDustedOffGap(60, gaps)).toBe(true);
    expect(isDustedOffGap(10, gaps)).toBe(false); // below 15 floor
    const tight = Array.from({ length: 50 }, () => 1); // heavy rotation
    expect(isDustedOffGap(2, tight)).toBe(false);     // p95=1 but floor blocks
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npx vitest run lib/queries/songs.test.ts`
Expected: FAIL — `p95`/`isDustedOffGap` not exported.

- [ ] **Step 3: Implement the helpers + the show-sequence SQL building blocks**

Create `lib/queries/songs.ts`:

```ts
import { db } from "@/db/client";
import { sql, type SQL } from "drizzle-orm";
import { setLabel } from "@/app/_components/setlist/shared";
import { trackSeconds } from "@/lib/queries/format";

function allRows(result: unknown): Record<string, unknown>[] {
  const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
  return rows as Record<string, unknown>[];
}
const num = (v: unknown): number => Number(v ?? 0);
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const strOrNull = (v: unknown): string | null => (v == null ? null : String(v));

/** Nearest-rank 95th percentile. 0 for empty. */
export function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(0.95 * (sorted.length - 1));
  return sorted[idx];
}

/** A gap is a "Dusted Off" return when it clears the 15-show floor AND the song's own p95. */
export function isDustedOffGap(gap: number | null, songGaps: number[]): boolean {
  if (gap == null || gap < 15) return false;
  return gap >= p95(songGaps);
}

// show_seq: number every PLAYED show with performances by (date, order).
// song_show: one row per (song, show) so same-show reprises don't create negative gaps.
// gapped: per (song, show) gap = seq - lag(seq) - 1.
const SHOW_SEQ = sql`
  show_seq as (
    select s.show_id,
           row_number() over (order by s.show_date, coalesce(s.show_order, 1)) as seq,
           s.show_date
    from shows s
    where s.show_date <= current_date
      and exists (select 1 from performances p where p.show_id = s.show_id)
  ),
  song_show as (
    select distinct p.song_id, ss.seq, ss.show_id, ss.show_date
    from performances p
    join show_seq ss on ss.show_id = p.show_id
  ),
  gapped as (
    select song_id, seq, show_id, show_date,
           seq - lag(seq) over (partition by song_id order by seq) - 1 as gap
    from song_show
  )`;
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run lib/queries/songs.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write a failing fixture test for `getSongPerformances` gap math**

Append to `lib/queries/songs.test.ts`:

```ts
const ctx = await makeTestDb();
afterAll(() => ctx.close());

// 5 shows on distinct dates; song 700 played at shows 1, 2, and 5.
// show_seq: 1..5 -> gaps for the song: [null(debut), 0, 3]. current gap (last show=5, song last seq=5) = 0.
async function seed() {
  await upsertArtists(ctx.db, [{ artistId: 1, name: "Goose" }]);
  await upsertVenues(ctx.db, [{ venueId: 1, name: "The Cap", slug: "cap", city: "Port Chester", state: "NY", country: "USA", zip: null, capacity: 1800 }]);
  await upsertTours(ctx.db, []);
  await upsertSongs(ctx.db, [
    { songId: 700, name: "Hot Tea", slug: "hot-tea", isOriginal: true, originalArtist: null },
    { songId: 701, name: "Madhuvan", slug: "madhuvan", isOriginal: true, originalArtist: null },
  ]);
  const dates = ["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-04", "2020-01-05"];
  await upsertShows(ctx.db, dates.map((d, i) => ({
    showId: i + 1, showDate: d, artistId: 1, venueId: 1, tourId: null,
    title: null, permalink: `p${i}`, showOrder: 1, notes: null, createdAt: null, updatedAt: null,
  })));
  // Madhuvan every show so show_seq covers all 5; Hot Tea at shows 1,2,5.
  const perf: any[] = [];
  dates.forEach((_, i) => perf.push({ uniqueId: `m${i}`, showId: i + 1, songId: 701, setType: "Set", setNumber: "1", position: 1, trackTime: "5:00", transition: null, transitionId: null, isJamchart: false, jamchartNotes: null, isReprise: false, isJam: false, isVerified: true, footnote: null }));
  [0, 1, 4].forEach((i) => perf.push({ uniqueId: `h${i}`, showId: i + 1, songId: 700, setType: "Set", setNumber: "1", position: 2, trackTime: i === 4 ? "14:00" : "8:00", transition: null, transitionId: null, isJamchart: i === 4, jamchartNotes: i === 4 ? "big" : null, isReprise: false, isJam: false, isVerified: true, footnote: null }));
  await upsertPerformances(ctx.db, perf);
}

describe("getSongPerformances", () => {
  it("computes per-performance gaps over distinct shows", async () => {
    await seed();
    const { getSongPerformances } = await import("./songs");
    const perfs = await getSongPerformances(700);
    expect(perfs.map((p) => p.date)).toEqual(["2020-01-05", "2020-01-02", "2020-01-01"]); // newest first
    const byDate = Object.fromEntries(perfs.map((p) => [p.date, p.gap]));
    expect(byDate["2020-01-01"]).toBeNull(); // debut
    expect(byDate["2020-01-02"]).toBe(0);    // back-to-back
    expect(byDate["2020-01-05"]).toBe(2);    // shows 3 and 4 skipped
  });
});
```

- [ ] **Step 6: Run it, verify failure** — Run: `npx vitest run lib/queries/songs.test.ts` → FAIL (`getSongPerformances` undefined).

- [ ] **Step 7: Implement `SongPerf` + `getSongPerformances`**

Append to `lib/queries/songs.ts`:

```ts
export type SongPerf = {
  uniqueId: string; date: string; showId: number; order: number | null;
  venue: string | null; city: string | null; state: string | null;
  setLabel: string; position: number | null;
  trackTime: string | null; seconds: number | null;
  gap: number | null; isJam: boolean; isJamchart: boolean; isDustedOff: boolean;
};

export async function getSongPerformances(songId: number): Promise<SongPerf[]> {
  const rows = allRows(await db.execute(sql`
    with ${SHOW_SEQ}
    select p.unique_id, s.show_date::text as date, s.show_id, s.show_order as "order",
           v.name as venue, v.city, v.state,
           p.set_type, p.set_number, p.position, p.track_time,
           g.gap, p.is_jam, p.is_jamchart
    from performances p
    join shows s on s.show_id = p.show_id
    left join venues v on v.venue_id = s.venue_id
    join gapped g on g.song_id = p.song_id and g.show_id = p.show_id
    where p.song_id = ${songId}
    order by s.show_date desc, coalesce(s.show_order, 1) desc, p.position asc
  `));
  const gaps = rows.map((r) => numOrNull(r.gap)).filter((g): g is number => g != null);
  return rows.map((r) => {
    const tt = strOrNull(r.track_time);
    const gap = numOrNull(r.gap);
    return {
      uniqueId: String(r.unique_id), date: String(r.date), showId: num(r.show_id),
      order: numOrNull(r.order), venue: strOrNull(r.venue), city: strOrNull(r.city), state: strOrNull(r.state),
      setLabel: setLabel(strOrNull(r.set_type), strOrNull(r.set_number)), position: numOrNull(r.position),
      trackTime: tt, seconds: trackSeconds(tt),
      gap, isJam: Boolean(r.is_jam), isJamchart: Boolean(r.is_jamchart),
      isDustedOff: isDustedOffGap(gap, gaps),
    };
  });
}
```

- [ ] **Step 8: Run tests, verify pass** — Run: `npx vitest run lib/queries/songs.test.ts` → PASS.

- [ ] **Step 9: Write a failing test for `getSongBySlug` headline stats**

Append:

```ts
describe("getSongBySlug", () => {
  it("returns headline stats for a song", async () => {
    await seed();
    const { getSongBySlug } = await import("./songs");
    const s = await getSongBySlug("hot-tea");
    expect(s).not.toBeNull();
    expect(s!.name).toBe("Hot Tea");
    expect(s!.timesPlayed).toBe(3);
    expect(s!.debutDate).toBe("2020-01-01");
    expect(s!.lastPlayedDate).toBe("2020-01-05");
    expect(s!.currentGap).toBe(0);          // played at the latest show
    expect(s!.longestVersions[0].trackTime).toBe("14:00");
    expect(s!.playsPerYear).toEqual([{ year: 2020, count: 3 }]);
    expect(await getSongBySlug("nope")).toBeNull();
  });
});
```

- [ ] **Step 10: Run it, verify failure** — FAIL (`getSongBySlug` undefined).

- [ ] **Step 11: Implement `SongStat` + `getSongBySlug`**

Append to `lib/queries/songs.ts`:

```ts
export type SongStat = {
  songId: number; name: string; slug: string; isOriginal: boolean; originalArtist: string | null;
  timesPlayed: number;
  debutDate: string | null; debutShowId: number | null; debutOrder: number | null;
  lastPlayedDate: string | null; lastShowId: number | null; lastOrder: number | null;
  currentGap: number | null; longestGap: number | null; avgGap: number | null;
  rotationPct: number; longestSeconds: number | null;
  playsPerYear: { year: number; count: number }[];
  setPlacement: { set1: number; set2: number; encore: number; opener: number; jammed: number };
  longestVersions: { date: string; showId: number; order: number | null; venue: string | null; trackTime: string; seconds: number }[];
  topVenues: { venueId: number; name: string; count: number }[];
};

export async function getSongBySlug(slug: string): Promise<SongStat | null> {
  const [meta] = allRows(await db.execute(sql`
    select song_id, name, slug, is_original, original_artist from songs where slug = ${slug} order by song_id limit 1
  `));
  if (!meta) return null;
  const songId = num(meta.song_id);

  const perfs = await getSongPerformances(songId); // newest-first, carries gap
  const timesPlayed = perfs.length;
  const debut = perfs[perfs.length - 1] ?? null;
  const last = perfs[0] ?? null;
  const gaps = perfs.map((p) => p.gap).filter((g): g is number => g != null);
  const longestGap = gaps.length ? Math.max(...gaps) : null;
  const avgGap = gaps.length ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10 : null;

  // current gap = max(seq) - last perf seq
  const [cg] = allRows(await db.execute(sql`
    with ${SHOW_SEQ}
    select (select max(seq) from show_seq) - max(g.seq) as current_gap
    from gapped g where g.song_id = ${songId}
  `));
  const currentGap = numOrNull(cg?.current_gap);

  // rotation = timesPlayed / shows since debut (inclusive)
  const [rot] = allRows(await db.execute(sql`
    with ${SHOW_SEQ},
    deb as (select min(seq) as d from gapped where song_id = ${songId})
    select (select count(*) from show_seq, deb where seq >= deb.d) as denom
  `));
  const denom = num(rot?.denom) || 1;
  const rotationPct = Math.round((timesPlayed / denom) * 1000) / 10;

  // plays per year
  const ppy = allRows(await db.execute(sql`
    select extract(year from s.show_date)::int as year, count(*)::int as count
    from performances p join shows s on s.show_id = p.show_id
    where p.song_id = ${songId} and s.show_date <= current_date
    group by 1 order by 1
  `)).map((r) => ({ year: num(r.year), count: num(r.count) }));

  // set placement percentages
  const place = allRows(await db.execute(sql`
    select
      count(*) filter (where set_type <> 'Encore' and (set_number = '1' or set_type = 'One Set'))::int as set1,
      count(*) filter (where set_number = '2')::int as set2,
      count(*) filter (where set_type = 'Encore' or set_number ilike 'e%')::int as encore,
      count(*) filter (where position = 1)::int as opener,
      count(*) filter (where is_jam or is_jamchart)::int as jammed,
      count(*)::int as total
    from performances where song_id = ${songId}
  `))[0];
  const tot = num(place?.total) || 1;
  const pct = (v: unknown) => Math.round((num(v) / tot) * 100);
  const setPlacement = { set1: pct(place?.set1), set2: pct(place?.set2), encore: pct(place?.encore), opener: pct(place?.opener), jammed: pct(place?.jammed) };

  const longestVersions = perfs
    .filter((p) => p.seconds != null)
    .sort((a, b) => (b.seconds ?? 0) - (a.seconds ?? 0))
    .slice(0, 5)
    .map((p) => ({ date: p.date, showId: p.showId, order: p.order, venue: p.venue, trackTime: p.trackTime!, seconds: p.seconds! }));

  const topVenues = allRows(await db.execute(sql`
    select v.venue_id, v.name, count(*)::int as count
    from performances p join shows s on s.show_id = p.show_id
    join venues v on v.venue_id = s.venue_id
    where p.song_id = ${songId}
    group by v.venue_id, v.name order by count desc, v.name asc limit 5
  `)).map((r) => ({ venueId: num(r.venue_id), name: String(r.name), count: num(r.count) }));

  return {
    songId, name: String(meta.name), slug: String(meta.slug),
    isOriginal: Boolean(meta.is_original), originalArtist: strOrNull(meta.original_artist),
    timesPlayed,
    debutDate: debut?.date ?? null, debutShowId: debut?.showId ?? null, debutOrder: debut?.order ?? null,
    lastPlayedDate: last?.date ?? null, lastShowId: last?.showId ?? null, lastOrder: last?.order ?? null,
    currentGap, longestGap, avgGap, rotationPct,
    longestSeconds: longestVersions[0]?.seconds ?? null,
    playsPerYear: ppy, setPlacement, longestVersions, topVenues,
  };
}
```

- [ ] **Step 12: Run the full file, verify pass** — Run: `npx vitest run lib/queries/songs.test.ts` → PASS (all).

- [ ] **Step 13: Typecheck + commit**

Run: `npm run typecheck` → no errors.
```bash
git add lib/queries/songs.ts lib/queries/songs.test.ts
git commit -m "feat(songs): song-stats core — show-sequence gaps, Dusted Off, getSongBySlug"
```

---

## Task 2: Song index query — `listSongs`

**Files:**
- Modify: `lib/queries/songs.ts`
- Modify: `lib/queries/songs.test.ts`

**Interfaces:**
- Consumes: the `SHOW_SEQ` block + helpers from Task 1.
- Produces:
  - `type SongSort = "played" | "rare" | "overdue" | "recent" | "debut" | "az"`
  - `type SongFacet = "all" | "originals" | "covers"`
  - `type SongIndexRow = { songId; name; slug; isOriginal; timesPlayed; rotationPct; currentGap: number | null; lastPlayedDate: string | null; debutYear: number | null; playsPerYear: number[] }` — `playsPerYear` is counts across the fixed span `INDEX_YEARS` (oldest→newest) for the row sparkline.
  - `const INDEX_YEARS: number[]` — the year span the sparkline covers (debut-of-band → current year).
  - `listSongs(opts: { sort?: SongSort; facet?: SongFacet; q?: string }): Promise<SongIndexRow[]>`

- [ ] **Step 1: Write failing tests for `listSongs`**

Append to `lib/queries/songs.test.ts`:

```ts
describe("listSongs", () => {
  it("sorts by most played and overdue, and facets originals/covers", async () => {
    await seed();
    await upsertSongs(ctx.db, [{ songId: 702, name: "Bowie", slug: "bowie", isOriginal: false, originalArtist: "David Bowie" }]);
    await upsertPerformances(ctx.db, [{ uniqueId: "b0", showId: 1, songId: 702, setType: "Set", setNumber: "1", position: 3, trackTime: "6:00", transition: null, transitionId: null, isJamchart: false, jamchartNotes: null, isReprise: false, isJam: false, isVerified: true, footnote: null }]);
    const { listSongs } = await import("./songs");

    const played = await listSongs({ sort: "played" });
    expect(played[0].name).toBe("Madhuvan"); // 5 plays
    expect(played.find((r) => r.slug === "hot-tea")!.timesPlayed).toBe(3);

    const overdue = await listSongs({ sort: "overdue" });
    expect(overdue[0].slug).toBe("bowie"); // last played show 1, biggest current gap

    const covers = await listSongs({ facet: "covers" });
    expect(covers.map((r) => r.slug)).toEqual(["bowie"]);

    const filtered = await listSongs({ q: "tea" });
    expect(filtered.map((r) => r.slug)).toEqual(["hot-tea"]);
  });
});
```

- [ ] **Step 2: Run it, verify failure** — FAIL (`listSongs` undefined).

- [ ] **Step 3: Implement `listSongs`**

Append to `lib/queries/songs.ts`:

```ts
export type SongSort = "played" | "rare" | "overdue" | "recent" | "debut" | "az";
export type SongFacet = "all" | "originals" | "covers";
export type SongIndexRow = {
  songId: number; name: string; slug: string; isOriginal: boolean;
  timesPlayed: number; rotationPct: number; currentGap: number | null;
  lastPlayedDate: string | null; debutYear: number | null; playsPerYear: number[];
};

export async function listSongs(opts: { sort?: SongSort; facet?: SongFacet; q?: string } = {}): Promise<SongIndexRow[]> {
  const sort = opts.sort ?? "played";
  const facet = opts.facet ?? "all";
  const facetCond =
    facet === "originals" ? sql`and so.is_original` :
    facet === "covers" ? sql`and not so.is_original` : sql``;
  const qCond = opts.q?.trim() ? sql`and so.name ilike ${"%" + opts.q.trim() + "%"}` : sql``;

  // year span for the sparkline
  const [span] = allRows(await db.execute(sql`
    select extract(year from min(show_date))::int as lo, extract(year from current_date)::int as hi
    from shows where show_date <= current_date
  `));
  const lo = num(span?.lo) || new Date().getUTCFullYear();
  const hi = num(span?.hi) || lo;
  const years: number[] = [];
  for (let y = lo; y <= hi; y++) years.push(y);

  const orderBy =
    sort === "rare" ? sql`times_played asc, last_seq desc nulls last` :
    sort === "overdue" ? sql`(times_played >= 5) desc, current_gap desc nulls last` :
    sort === "recent" ? sql`last_seq desc nulls last` :
    sort === "debut" ? sql`debut_seq desc nulls last` :
    sort === "az" ? sql`lower(name) asc` :
    sql`times_played desc, lower(name) asc`;

  const rows = allRows(await db.execute(sql`
    with ${SHOW_SEQ},
    agg as (
      select song_id, count(*)::int as times_played,
             min(seq) as debut_seq, max(seq) as last_seq,
             (select max(seq) from show_seq) - max(seq) as current_gap
      from gapped group by song_id
    )
    select so.song_id, so.name, so.slug, so.is_original,
           coalesce(a.times_played, 0) as times_played,
           a.current_gap, a.debut_seq, a.last_seq,
           (select max(show_date)::text from song_show ssh where ssh.song_id = so.song_id) as last_date,
           (select min(show_date) from song_show ssh where ssh.song_id = so.song_id) as debut_date,
           round((coalesce(a.times_played,0)::numeric /
                  greatest((select count(*) from show_seq where seq >= a.debut_seq), 1)) * 1000) / 10 as rotation
    from songs so
    left join agg a on a.song_id = so.song_id
    where coalesce(a.times_played, 0) > 0 ${facetCond} ${qCond}
    order by ${orderBy}
  `));

  // plays per year per song (one grouped query, bucket in TS)
  const ppyRows = allRows(await db.execute(sql`
    select p.song_id, extract(year from s.show_date)::int as year, count(*)::int as c
    from performances p join shows s on s.show_id = p.show_id
    where s.show_date <= current_date group by 1, 2
  `));
  const ppy = new Map<number, Map<number, number>>();
  for (const r of ppyRows) {
    const sid = num(r.song_id);
    if (!ppy.has(sid)) ppy.set(sid, new Map());
    ppy.get(sid)!.set(num(r.year), num(r.c));
  }

  return rows.map((r) => {
    const sid = num(r.song_id);
    const byYear = ppy.get(sid) ?? new Map();
    return {
      songId: sid, name: String(r.name), slug: String(r.slug), isOriginal: Boolean(r.is_original),
      timesPlayed: num(r.times_played), rotationPct: num(r.rotation), currentGap: numOrNull(r.current_gap),
      lastPlayedDate: strOrNull(r.last_date),
      debutYear: r.debut_date ? new Date(String(r.debut_date)).getUTCFullYear() : null,
      playsPerYear: years.map((y) => byYear.get(y) ?? 0),
    };
  });
}

export const INDEX_YEARS_NOTE = "playsPerYear aligns to the band's year span, oldest→newest";
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run lib/queries/songs.test.ts` → PASS.
- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add lib/queries/songs.ts lib/queries/songs.test.ts
git commit -m "feat(songs): listSongs — sortable index rows with per-row plays-per-year"
```

---

## Task 3: Stats-hub queries

**Files:**
- Modify: `lib/queries/songs.ts`
- Modify: `lib/queries/songs.test.ts`

**Interfaces:**
- Consumes: `listSongs`, `SHOW_SEQ`, helpers.
- Produces:
  - `mostPlayed(limit?: number): Promise<SongIndexRow[]>` — `listSongs({ sort: "played" })` sliced.
  - `rarities(limit?: number): Promise<SongIndexRow[]>` — songs played 1–3×, fewest first.
  - `currentGaps(limit?: number): Promise<SongIndexRow[]>` — active-rotation (`timesPlayed >= 5`) by current gap desc.
  - `debutsByYear(): Promise<{ year: number; count: number }[]>` and `recentDebuts(limit?: number): Promise<{ slug: string; name: string; date: string; venue: string | null }[]>`.
  - `setStats(): Promise<{ key: string; label: string; rows: { slug: string; name: string; count: number }[] }[]>` — buckets: show openers, set-1 openers, set-2 openers, encores, set closers.

- [ ] **Step 1: Write failing tests**

Append:

```ts
describe("stats cuts", () => {
  it("rarities are low-play; currentGaps excludes one-timers", async () => {
    await seed();
    await upsertSongs(ctx.db, [{ songId: 702, name: "Bowie", slug: "bowie", isOriginal: false, originalArtist: "David Bowie" }]);
    await upsertPerformances(ctx.db, [{ uniqueId: "b0", showId: 1, songId: 702, setType: "Set", setNumber: "1", position: 3, trackTime: "6:00", transition: null, transitionId: null, isJamchart: false, jamchartNotes: null, isReprise: false, isJam: false, isVerified: true, footnote: null }]);
    const { rarities, currentGaps, debutsByYear, setStats } = await import("./songs");

    expect((await rarities()).map((r) => r.slug)).toContain("bowie"); // 1 play
    expect((await currentGaps()).every((r) => r.timesPlayed >= 5)).toBe(true);
    expect((await debutsByYear())).toEqual([{ year: 2020, count: 3 }]);
    const opener = (await setStats()).find((b) => b.key === "show-opener");
    expect(opener!.rows[0].slug).toBe("madhuvan"); // position 1 every show
  });
});
```

- [ ] **Step 2: Run it, verify failure.**

- [ ] **Step 3: Implement the cuts**

Append to `lib/queries/songs.ts`:

```ts
export async function mostPlayed(limit = 100): Promise<SongIndexRow[]> {
  return (await listSongs({ sort: "played" })).slice(0, limit);
}
export async function rarities(limit = 100): Promise<SongIndexRow[]> {
  return (await listSongs({ sort: "rare" })).filter((r) => r.timesPlayed <= 3).slice(0, limit);
}
export async function currentGaps(limit = 100): Promise<SongIndexRow[]> {
  return (await listSongs({ sort: "overdue" })).filter((r) => r.timesPlayed >= 5).slice(0, limit);
}
export async function debutsByYear(): Promise<{ year: number; count: number }[]> {
  return allRows(await db.execute(sql`
    with ${SHOW_SEQ},
    debut as (select song_id, min(show_date) as d from song_show group by song_id)
    select extract(year from d)::int as year, count(*)::int as count from debut group by 1 order by 1
  `)).map((r) => ({ year: num(r.year), count: num(r.count) }));
}
export async function recentDebuts(limit = 25): Promise<{ slug: string; name: string; date: string; venue: string | null }[]> {
  return allRows(await db.execute(sql`
    with first_play as (
      select p.song_id, min(s.show_date) as d
      from performances p join shows s on s.show_id = p.show_id
      where s.show_date <= current_date group by p.song_id
    )
    select so.slug, so.name, fp.d::text as date,
      (select v.name from shows s2 left join venues v on v.venue_id = s2.venue_id
       where s2.show_date = fp.d order by coalesce(s2.show_order,1) limit 1) as venue
    from first_play fp join songs so on so.song_id = fp.song_id
    order by fp.d desc, so.name asc limit ${limit}
  `)).map((r) => ({ slug: String(r.slug), name: String(r.name), date: String(r.date), venue: strOrNull(r.venue) }));
}
export async function setStats(): Promise<{ key: string; label: string; rows: { slug: string; name: string; count: number }[] }[]> {
  const buckets: { key: string; label: string; cond: SQL }[] = [
    { key: "show-opener", label: "Show openers", cond: sql`p.position = 1 and (p.set_number = '1' or p.set_type = 'One Set')` },
    { key: "set2-opener", label: "Set 2 openers", cond: sql`p.position = 1 and p.set_number = '2'` },
    { key: "encore", label: "Encores", cond: sql`p.set_type = 'Encore' or p.set_number ilike 'e%'` },
  ];
  const out = [];
  for (const b of buckets) {
    const rows = allRows(await db.execute(sql`
      select so.slug, so.name, count(*)::int as count
      from performances p join songs so on so.song_id = p.song_id
      join shows s on s.show_id = p.show_id
      where s.show_date <= current_date and (${b.cond})
      group by so.slug, so.name order by count desc, so.name asc limit 15
    `)).map((r) => ({ slug: String(r.slug), name: String(r.name), count: num(r.count) }));
    out.push({ key: b.key, label: b.label, rows });
  }
  return out;
}
```

- [ ] **Step 4: Run tests, verify pass.**
- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add lib/queries/songs.ts lib/queries/songs.test.ts
git commit -m "feat(songs): stats cuts — most-played, rarities, current-gaps, debuts, set-stats"
```

---

## Task 4: Slug backfill + format helpers

**Files:**
- Create: `db/slugs.ts`
- Create: `db/slugs.test.ts`
- Create: `scripts/backfill-slugs.ts`
- Modify: `lib/queries/format.ts`
- Modify: `lib/sync/run.ts` (call after song upsert — confirm filename via `grep -rl "upsertSongs" lib/sync scripts`)

**Interfaces:**
- Produces:
  - `slugifySongName(name: string): string` (in `format.ts`) — lowercase, strip diacritics, non-alphanumerics → `-`, trim.
  - `const RETURN_LABEL = "Dusted Off"` and `songHref(s: { slug: string | null; songId?: number }): string` (in `format.ts`).
  - `ensureSongSlugs(db: AppDb): Promise<number>` (in `db/slugs.ts`) — fills null/empty + dedupes; returns number of rows updated. Idempotent.

- [ ] **Step 1: Failing test for `slugifySongName` + `songHref`**

Create `lib/queries/format.test.ts` additions — append to the existing file if present, else create:

```ts
import { describe, it, expect } from "vitest";
import { slugifySongName, songHref, RETURN_LABEL } from "./format";

describe("song slugs", () => {
  it("slugifies names", () => {
    expect(slugifySongName("Hot Tea")).toBe("hot-tea");
    expect(slugifySongName("Bob Dylan’s Dream")).toBe("bob-dylans-dream");
    expect(slugifySongName("Arcadia (Reprise)")).toBe("arcadia-reprise");
  });
  it("songHref prefers slug", () => {
    expect(songHref({ slug: "hot-tea" })).toBe("/songs/hot-tea");
    expect(RETURN_LABEL).toBe("Dusted Off");
  });
});
```

- [ ] **Step 2: Run it, verify failure.**

- [ ] **Step 3: Implement helpers in `lib/queries/format.ts`** (append):

```ts
export const RETURN_LABEL = "Dusted Off";

export function slugifySongName(name: string): string {
  return name
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function songHref(s: { slug: string | null; songId?: number }): string {
  return `/songs/${s.slug ?? (s.songId != null ? slugifySongName(String(s.songId)) : "")}`;
}
```

- [ ] **Step 4: Run it, verify pass.**

- [ ] **Step 5: Failing test for `ensureSongSlugs`**

Create `db/slugs.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { makeTestDb } from "./testing";
import { upsertSongs } from "./repository";
import { songs } from "./schema";
import { ensureSongSlugs } from "./slugs";

const ctx = await makeTestDb();
afterAll(() => ctx.close());

describe("ensureSongSlugs", () => {
  it("fills missing slugs and dedupes deterministically; idempotent", async () => {
    await upsertSongs(ctx.db, [
      { songId: 1, name: "Hot Tea", slug: null, isOriginal: true, originalArtist: null },
      { songId: 2, name: "Hot Tea", slug: "", isOriginal: false, originalArtist: "Cover Band" },
      { songId: 3, name: "Arcadia", slug: "arcadia", isOriginal: true, originalArtist: null },
    ]);
    const n1 = await ensureSongSlugs(ctx.db);
    expect(n1).toBeGreaterThanOrEqual(2);
    const rows = await ctx.db.select().from(songs);
    const bySlug = rows.map((r) => r.slug).sort();
    expect(new Set(bySlug).size).toBe(rows.length); // all unique
    expect(rows.find((r) => r.songId === 1)!.slug).toBe("hot-tea");
    expect(rows.find((r) => r.songId === 2)!.slug).toBe("hot-tea-2"); // dedupe by id
    const n2 = await ensureSongSlugs(ctx.db);
    expect(n2).toBe(0); // idempotent
  });
});
```

- [ ] **Step 6: Run it, verify failure.**

- [ ] **Step 7: Implement `db/slugs.ts`**

```ts
import { sql } from "drizzle-orm";
import type { AppDb } from "./schema";
import { songs } from "./schema";
import { slugifySongName } from "@/lib/queries/format";

/** Fill null/empty slugs and resolve collisions deterministically (lowest songId keeps the base,
 *  others get `-<songId>`). Idempotent — returns count of rows whose slug changed. */
export async function ensureSongSlugs(db: AppDb): Promise<number> {
  const rows = await db.select({ songId: songs.songId, name: songs.name, slug: songs.slug }).from(songs);
  const taken = new Map<string, number>(); // slug -> owning songId
  // Pass 1: keep valid, unique existing slugs (lowest id wins on conflict).
  const sorted = [...rows].sort((a, b) => a.songId - b.songId);
  const desired = new Map<number, string>();
  for (const r of sorted) {
    const base = (r.slug && r.slug.trim()) ? r.slug.trim() : slugifySongName(r.name) || `song-${r.songId}`;
    let candidate = base;
    if (taken.has(candidate)) candidate = `${base}-${r.songId}`;
    while (taken.has(candidate)) candidate = `${candidate}-x`;
    taken.set(candidate, r.songId);
    desired.set(r.songId, candidate);
  }
  let changed = 0;
  for (const r of sorted) {
    const want = desired.get(r.songId)!;
    if (want !== r.slug) {
      await db.update(songs).set({ slug: want }).where(sql`${songs.songId} = ${r.songId}`);
      changed++;
    }
  }
  return changed;
}
```

- [ ] **Step 8: Run it, verify pass.**

- [ ] **Step 9: Wire into sync + add the one-shot script**

The orchestrator is `lib/sync/run.ts`. Immediately after the song upsert call there, add:

```ts
import { ensureSongSlugs } from "@/db/slugs";
// …after upsertSongs(db, songs):
await ensureSongSlugs(db);
```

Create `scripts/backfill-slugs.ts`:

```ts
import { db } from "@/db/client";
import { ensureSongSlugs } from "@/db/slugs";

const n = await ensureSongSlugs(db as never);
console.log(`ensureSongSlugs: updated ${n} song slugs`);
process.exit(0);
```

Add to `package.json` scripts: `"backfill-slugs": "tsx scripts/backfill-slugs.ts"`.

- [ ] **Step 10: Run sync test suite + typecheck**

Run: `npx vitest run lib/sync db/slugs.test.ts` and `npm run typecheck`. Expected: PASS. (If the sync run test asserts an exact call sequence, update it to include the backfill call.)

- [ ] **Step 11: Commit**

```bash
git add db/slugs.ts db/slugs.test.ts scripts/backfill-slugs.ts lib/queries/format.ts lib/queries/format.test.ts package.json lib/sync
git commit -m "feat(songs): stable unique slugs — backfill in sync + one-shot script + songHref/RETURN_LABEL"
```

---

## Task 5: Shared song components + CSS

**Files:**
- Create: `app/_components/song/scroll-table.tsx`, `ribbon.tsx`, `charts.tsx`, `perf-table.tsx`, `index-table.tsx`, `index.ts`
- Create: `app/_components/song/index-table.test.tsx`, `app/_components/song/perf-table.test.tsx`
- Modify: `app/globals.css`

**Interfaces (Produces):**
- `ScrollTable({ children })` — wraps a `<table>` in `<div class="song-scroll"><div class="song-scroll-inner">…</div><span class="song-scroll-fade"/></div>` + a "swipe →" cue.
- `FactRibbon({ facts }: { facts: { k: string; v: ReactNode }[] })`.
- `PlaysPerYearChart({ data }: { data: { year: number; count: number }[] })`, `SetPlacementBars({ placement })`, `GapSparkline({ perfs }: { perfs: SongPerf[] })`, `MiniSparkline({ values }: { values: number[] })`.
- `PerformanceTable({ perfs }: { perfs: SongPerf[] })` — dense pin+scroll log with gap + Dusted-Off marker.
- `SongIndexTable({ rows, years }: { rows: SongIndexRow[]; years: number[] })`.

These render mode-agnostic class names; `[data-experience="functional"]` reskins them. They are used by Fancy & Functional only (never the minimal branch).

- [ ] **Step 1: Failing render test for `SongIndexTable` and `PerformanceTable`**

Create `app/_components/song/index-table.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SongIndexTable } from "./index-table";
import type { SongIndexRow } from "@/lib/queries/songs";

const row: SongIndexRow = {
  songId: 1, name: "Hot Tea", slug: "hot-tea", isOriginal: true,
  timesPlayed: 187, rotationPct: 29, currentGap: 3, lastPlayedDate: "2026-06-12",
  debutYear: 2017, playsPerYear: [2, 5, 4, 1, 7, 9, 10, 8, 6, 5],
};
describe("SongIndexTable", () => {
  it("links the song and pins the identity column", () => {
    const html = renderToStaticMarkup(<SongIndexTable rows={[row]} years={[2017,2018,2019,2020,2021,2022,2023,2024,2025,2026]} />);
    expect(html).toContain('href="/songs/hot-tea"');
    expect(html).toContain("song-pin");      // sticky identity column
    expect(html).toContain("187");
  });
});
```

Create `app/_components/song/perf-table.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PerformanceTable } from "./perf-table";
import type { SongPerf } from "@/lib/queries/songs";

const base: SongPerf = {
  uniqueId: "x", date: "2026-06-12", showId: 9, order: 1, venue: "The Cap", city: "Port Chester", state: "NY",
  setLabel: "Set II", position: 4, trackTime: "14:20", seconds: 860, gap: 52, isJam: true, isJamchart: true, isDustedOff: true,
};
describe("PerformanceTable", () => {
  it("shows the Dusted Off marker with the gap number", () => {
    const html = renderToStaticMarkup(<PerformanceTable perfs={[base]} />);
    expect(html).toContain("Dusted Off");
    expect(html).toContain("52");
    expect(html).toContain('href="/shows/2026-06-12"');
  });
});
```

- [ ] **Step 2: Run them, verify failure.**

- [ ] **Step 3: Implement `ScrollTable`**

`app/_components/song/scroll-table.tsx`:

```tsx
import type { ReactNode } from "react";

export function ScrollTable({ children, swipeHint = "swipe → for more" }: { children: ReactNode; swipeHint?: string }) {
  return (
    <div className="song-scroll">
      <div className="song-scroll-inner">{children}</div>
      <span className="song-scroll-fade" aria-hidden />
      <p className="song-scroll-hint">{swipeHint}</p>
    </div>
  );
}
```

- [ ] **Step 4: Implement `ribbon.tsx`, `charts.tsx`, `perf-table.tsx`, `index-table.tsx`, `index.ts`**

`app/_components/song/ribbon.tsx`:

```tsx
import type { ReactNode } from "react";
export function FactRibbon({ facts }: { facts: { k: string; v: ReactNode }[] }) {
  return (
    <div className="song-ribbon">
      {facts.map((f, i) => (
        <div className="song-fact" key={i}>
          <div className="song-fact-v">{f.v}</div>
          <div className="song-fact-k">{f.k}</div>
        </div>
      ))}
    </div>
  );
}
```

`app/_components/song/charts.tsx`:

```tsx
import type { SongPerf } from "@/lib/queries/songs";

function maxOf(ns: number[]): number { return Math.max(1, ...ns); }

export function PlaysPerYearChart({ data }: { data: { year: number; count: number }[] }) {
  const max = maxOf(data.map((d) => d.count));
  return (
    <div className="song-ppy" role="img" aria-label="Plays per year">
      {data.map((d) => (
        <div className="song-ppy-col" key={d.year}>
          <div className="song-ppy-bar" style={{ height: `${Math.round((d.count / max) * 100)}%` }} title={`${d.year}: ${d.count}`} />
          <div className="song-ppy-ct">{d.count}</div>
          <div className="song-ppy-yr">{String(d.year).slice(2)}</div>
        </div>
      ))}
    </div>
  );
}

export function SetPlacementBars({ placement }: { placement: { set1: number; set2: number; encore: number; opener: number; jammed: number } }) {
  const rows: [string, number][] = [["Set 1", placement.set1], ["Set 2", placement.set2], ["Encore", placement.encore], ["Opener", placement.opener], ["Jammed", placement.jammed]];
  return (
    <div className="song-bars">
      {rows.map(([label, pct]) => (
        <div className="song-barrow" key={label}>
          <span className="song-bar-label">{label}</span>
          <span className="song-bar"><span style={{ width: `${pct}%` }} /></span>
          <span className="song-bar-pct">{pct}%</span>
        </div>
      ))}
    </div>
  );
}

export function GapSparkline({ perfs }: { perfs: SongPerf[] }) {
  const series = [...perfs].reverse(); // oldest→newest
  const max = maxOf(series.map((p) => p.gap ?? 0));
  return (
    <div className="song-spark" role="img" aria-label="Gap before each performance">
      {series.map((p) => (
        <i key={p.uniqueId} className={p.isDustedOff ? "bust" : ""} style={{ height: `${Math.round(((p.gap ?? 0) / max) * 100)}%` }} title={`${p.date}: gap ${p.gap ?? 0}`} />
      ))}
    </div>
  );
}

export function MiniSparkline({ values }: { values: number[] }) {
  const max = maxOf(values);
  return (
    <span className="song-mspark" aria-hidden>
      {values.map((v, i) => <i key={i} style={{ height: `${Math.max(4, Math.round((v / max) * 100))}%` }} />)}
    </span>
  );
}
```

`app/_components/song/perf-table.tsx`:

```tsx
import Link from "next/link";
import { showHref, RETURN_LABEL } from "@/lib/queries/format";
import type { SongPerf } from "@/lib/queries/songs";
import { ScrollTable } from "./scroll-table";

export function PerformanceTable({ perfs }: { perfs: SongPerf[] }) {
  return (
    <ScrollTable swipeHint="Date pinned · swipe → for venue, set, gap, time">
      <table className="song-table">
        <thead>
          <tr><th className="song-pin">Date</th><th>Venue</th><th>City</th><th>Set</th><th className="num">Gap</th><th className="num">Time</th><th>Notes</th></tr>
        </thead>
        <tbody>
          {perfs.map((p) => (
            <tr key={p.uniqueId}>
              <td className="song-pin"><Link href={showHref(p.date, p.order)}>{p.date}</Link></td>
              <td>{p.venue ?? "—"}</td>
              <td className="dim">{p.city ?? ""}</td>
              <td>{p.setLabel}</td>
              <td className="num gapcell">{p.gap ?? "—"}</td>
              <td className="num">{p.trackTime ?? "—"}</td>
              <td>
                {p.isDustedOff && <span className="song-bust">{RETURN_LABEL} · {p.gap}</span>}
                {p.isJamchart && <span className="song-jam">★ JAM</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollTable>
  );
}
```

`app/_components/song/index-table.tsx`:

```tsx
import Link from "next/link";
import { songHref } from "@/lib/queries/format";
import type { SongIndexRow } from "@/lib/queries/songs";
import { ScrollTable } from "./scroll-table";
import { MiniSparkline } from "./charts";

export function SongIndexTable({ rows, years }: { rows: SongIndexRow[]; years: number[] }) {
  const span = years.length ? `${String(years[0]).slice(2)}–${String(years[years.length - 1]).slice(2)}` : "";
  return (
    <ScrollTable swipeHint="Song pinned · swipe → for more stats">
      <table className="song-table">
        <thead>
          <tr>
            <th className="num">#</th><th className="song-pin">Song</th><th className="num">Played</th>
            <th>Activity {span}</th><th className="num">Rotation</th><th className="num">Gap</th><th>Last</th><th>Debut</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.songId}>
              <td className="num dim">{i + 1}</td>
              <td className="song-pin">
                <Link href={songHref(r)}>{r.name}</Link>
                {!r.isOriginal && <span className="song-cover">cover</span>}
              </td>
              <td className="num">{r.timesPlayed}</td>
              <td><MiniSparkline values={r.playsPerYear} /></td>
              <td className="num gold">{r.rotationPct}%</td>
              <td className={`num ${r.currentGap != null && r.currentGap >= 15 ? "overdue" : "gapcell"}`}>{r.currentGap ?? "—"}</td>
              <td className="dim">{r.lastPlayedDate ?? "—"}</td>
              <td className="dim">{r.debutYear ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollTable>
  );
}
```

`app/_components/song/index.ts`:

```ts
export { ScrollTable } from "./scroll-table";
export { FactRibbon } from "./ribbon";
export { PlaysPerYearChart, SetPlacementBars, GapSparkline, MiniSparkline } from "./charts";
export { PerformanceTable } from "./perf-table";
export { SongIndexTable } from "./index-table";
```

- [ ] **Step 5: Add CSS to `app/globals.css`** (append at end; base = Fancy tokens, then Functional reskin):

```css
/* ---- Phase 2: song stats (Fancy base; Functional reskin below) ---- */
.song-ribbon { display: grid; grid-template-columns: repeat(8, 1fr); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; margin: 1rem 0; }
.song-fact { background: var(--surface); padding: 0.6rem 0.85rem; }
.song-fact-v { font-family: var(--font-display); font-weight: 800; font-size: 1.2rem; color: var(--gold); font-variant-numeric: tabular-nums; }
.song-fact-k { font-size: 0.6rem; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); }
@media (max-width: 640px) { .song-ribbon { grid-template-columns: 1fr 1fr; } }

.song-cols { display: grid; grid-template-columns: 360px 1fr; gap: 1.6rem; align-items: start; }
@media (max-width: 820px) { .song-cols { grid-template-columns: 1fr; } }

.song-ppy { display: flex; align-items: flex-end; gap: 4px; height: 96px; border-bottom: 1px solid var(--line); }
.song-ppy-col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; }
.song-ppy-bar { width: 100%; background: linear-gradient(180deg, var(--gold), var(--gold-deep, #c8902f)); border-radius: 3px 3px 0 0; min-height: 3px; }
.song-ppy-ct { font-size: 0.6rem; color: var(--muted); }
.song-ppy-yr { font-size: 0.55rem; color: var(--faint); }

.song-bars { display: grid; gap: 6px; }
.song-barrow { display: grid; grid-template-columns: 84px 1fr 40px; align-items: center; gap: 10px; font-size: 0.82rem; }
.song-bar { height: 9px; border-radius: 5px; background: var(--surface-2, #2a2016); overflow: hidden; }
.song-bar > span { display: block; height: 100%; background: linear-gradient(90deg, var(--gold-deep, #c8902f), var(--gold)); }
.song-bar-pct { color: var(--gold); font-variant-numeric: tabular-nums; text-align: right; }

.song-spark { display: flex; align-items: flex-end; gap: 2px; height: 52px; }
.song-spark i { flex: 1; background: var(--gold-deep, #c8902f); border-radius: 1px; opacity: 0.8; min-height: 1px; }
.song-spark i.bust { background: var(--ember, #ff8a3d); opacity: 1; }
.song-mspark { display: inline-flex; align-items: flex-end; gap: 1px; height: 18px; width: 64px; vertical-align: middle; }
.song-mspark i { flex: 1; background: var(--gold-deep, #c8902f); border-radius: 1px; opacity: 0.85; min-height: 1px; }

/* dense table — pin identity column, scroll the rest */
.song-scroll { position: relative; border: 1px solid var(--line); border-radius: 10px; }
.song-scroll-inner { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 10px; }
.song-scroll-fade { position: absolute; top: 0; right: 0; width: 24px; height: 100%; pointer-events: none; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--bg) 80%, transparent)); }
.song-scroll-hint { font-size: 0.62rem; color: var(--faint); text-align: right; margin: 5px 8px 0; }
table.song-table { border-collapse: collapse; width: 100%; font-size: 0.85rem; white-space: nowrap; }
table.song-table th { text-align: left; font-size: 0.58rem; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--line); padding: 6px 9px; background: var(--bg); }
table.song-table td { padding: 5px 9px; border-bottom: 1px solid var(--line-soft, var(--line)); }
table.song-table .num { text-align: right; font-variant-numeric: tabular-nums; }
table.song-table .dim { color: var(--faint); }
table.song-table .gold { color: var(--gold); }
table.song-table .gapcell { color: var(--gold); }
table.song-table .overdue { color: var(--ember, #ff8a3d); font-weight: 700; }
table.song-table th.song-pin, table.song-table td.song-pin { position: sticky; left: 0; z-index: 2; background: var(--bg); border-right: 1px solid var(--line); min-width: 120px; }
.song-cover { font-size: 0.6rem; color: var(--faint); margin-left: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.song-bust { font-size: 0.62rem; color: var(--ember, #ff8a3d); border: 1px solid color-mix(in srgb, var(--ember, #ff8a3d) 45%, transparent); border-radius: 999px; padding: 1px 7px; margin-right: 6px; }
.song-jam { font-size: 0.62rem; color: var(--gold); }

/* Functional (Web 2.0) reskin */
[data-experience="functional"] .song-fact-v { color: #2c7cc4; }
[data-experience="functional"] .song-ppy-bar, [data-experience="functional"] .song-bar > span, [data-experience="functional"] .song-spark i, [data-experience="functional"] .song-mspark i { background: linear-gradient(180deg, #5aa9e6, #2c7cc4); }
[data-experience="functional"] .song-spark i.bust { background: linear-gradient(180deg, #f4a72b, #d98a10); }
[data-experience="functional"] table.song-table th { background: linear-gradient(#4a9be0, #2c7cc4); color: #fff; text-shadow: 0 -1px 0 rgba(0,0,0,0.22); }
[data-experience="functional"] table.song-table td { background: #fff; }
[data-experience="functional"] table.song-table tbody tr:nth-child(even) td { background: #eef5fb; }
[data-experience="functional"] table.song-table td.song-pin, [data-experience="functional"] table.song-table th.song-pin { background: inherit; }
[data-experience="functional"] .song-bust { color: #b8501a; border-color: #f4a72b; }
```

> Note: the `.song-*` rules use the project's **raw runtime tokens** from `:root` in `app/globals.css` — `--bg`, `--surface`, `--surface-2`, `--ink`, `--muted`, `--faint`, `--line`, `--line-soft`, `--gold`, `--gold-soft`, `--gold-deep`, `--ember` (the orange/flame accent), `--sage`. Do NOT use `--color-*` names: those live only inside the `@theme inline` map and are inlined into Tailwind utilities, so they are not runtime custom properties. (The Tailwind utility classes in the JSX — `text-gold`, `border-line`, etc. — are correct and unaffected.)

- [ ] **Step 6: Run the render tests, verify pass** — `npx vitest run app/_components/song`.
- [ ] **Step 7: Typecheck + commit**

```bash
npm run typecheck
git add app/_components/song app/globals.css
git commit -m "feat(songs): shared dense components (ribbon, charts, pin+scroll tables) + CSS"
```

---

## Task 6: `/songs` index page (3 modes)

**Files:**
- Create: `app/songs/page.tsx`

**Interfaces:** Consumes `listSongs`, `SongSort`, `SongFacet`, `SongIndexRow` (Task 2); `SongIndexTable` (Task 5); `Doc`, `Breadcrumb`, `EntityTable` (existing); `getExperience`.

- [ ] **Step 1: Implement the page**

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/app/_components/container";
import { Doc, Breadcrumb } from "@/app/_components/doc";
import { SongIndexTable } from "@/app/_components/song";
import { listSongs, type SongSort, type SongFacet } from "@/lib/queries/songs";
import { getExperience } from "@/lib/experience.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Songs", description: "Every Goose song, sortable by plays, rarity, gap, and debut." };

const SORTS: { key: SongSort; label: string }[] = [
  { key: "played", label: "Most played" }, { key: "rare", label: "Rarest" },
  { key: "overdue", label: "Most overdue" }, { key: "recent", label: "Recently played" },
  { key: "debut", label: "By debut" }, { key: "az", label: "A–Z" },
];
const FACETS: { key: SongFacet; label: string }[] = [
  { key: "all", label: "All" }, { key: "originals", label: "Originals" }, { key: "covers", label: "Covers" },
];

type SP = { sort?: SongSort; facet?: SongFacet; q?: string };

export default async function SongsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { sort = "played", facet = "all", q = "" } = await searchParams;
  const rows = await listSongs({ sort, facet, q });
  const experience = await getExperience();

  if (experience === "minimal") {
    return (
      <Container className="py-8">
        <Doc>
          <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { label: "Songs" }]} />
          <h1>Songs</h1>
          <p className="doc-crumb">{rows.length} songs · sorted by {SORTS.find((s) => s.key === sort)?.label}</p>
          <p className="doc-crumb">
            {SORTS.map((s) => <span key={s.key}>{s.key === sort ? <strong>{s.label}</strong> : <Link href={`/songs?sort=${s.key}`}>{s.label}</Link>}{" · "}</span>)}
          </p>
          <table className="doc-table">
            <thead><tr><th>Song</th><th className="num">Played</th><th className="num">Gap</th><th>Last</th><th>Debut</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.songId}>
                  <td><Link href={`/songs/${r.slug}`}>{r.name}</Link>{!r.isOriginal ? " (cover)" : ""}</td>
                  <td className="num">{r.timesPlayed}</td><td className="num">{r.currentGap ?? "—"}</td>
                  <td>{r.lastPlayedDate ?? "—"}</td><td>{r.debutYear ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Doc>
      </Container>
    );
  }

  // Fancy + Functional share this dense body.
  const yearsForTable = rows[0] ? deriveYears(rows) : [];
  return (
    <>
      <header className="relative overflow-hidden border-b border-line">
        <div className="stage-glow inset-x-0 top-0 h-72" />
        <Container className="relative py-10 sm:py-12">
          <span className="eyebrow">The catalog</span>
          <h1 className="mt-3 font-display text-[2.4rem] leading-none tracking-tight text-ink sm:text-5xl">Songs</h1>
          <p className="mt-2 font-mono text-xs text-faint">{rows.length} songs · sort the whole catalog any way you like</p>
        </Container>
      </header>
      <Container className="py-8">
        <div className="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {SORTS.map((s) => (
            <Link key={s.key} href={buildHref({ sort: s.key, facet, q })}
              className={s.key === sort ? "rounded-full bg-gold/15 px-3 py-1 text-gold ring-1 ring-gold/40" : "rounded-full px-3 py-1 text-muted transition hover:text-ink"}>
              {s.label}
            </Link>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-1.5 font-mono text-[0.7rem] text-faint">
          Filter:
          {FACETS.map((f) => (
            <Link key={f.key} href={buildHref({ sort, facet: f.key, q })}
              className={f.key === facet ? "rounded-full px-2.5 py-0.5 text-gold ring-1 ring-gold/40" : "rounded-full px-2.5 py-0.5 text-muted transition hover:text-ink"}>
              {f.label}
            </Link>
          ))}
        </div>
        <SongIndexTable rows={rows} years={yearsForTable} />
      </Container>
    </>
  );
}

function buildHref(sp: { sort: string; facet: string; q: string }) {
  const u = new URLSearchParams();
  if (sp.sort !== "played") u.set("sort", sp.sort);
  if (sp.facet !== "all") u.set("facet", sp.facet);
  if (sp.q) u.set("q", sp.q);
  const qs = u.toString();
  return qs ? `/songs?${qs}` : "/songs";
}
// The index rows carry counts aligned to the band's year span; recover labels from the first row length.
function deriveYears(rows: { playsPerYear: number[] }[]): number[] {
  const n = rows[0].playsPerYear.length;
  const hi = new Date().getUTCFullYear();
  return Array.from({ length: n }, (_, i) => hi - (n - 1) + i);
}
```

- [ ] **Step 2: Verify it builds + renders**

Start dev (only if not already running): `npm run dev`. Visit `/songs`, `/songs?sort=overdue`, `/songs?facet=covers`. Confirm the table renders, sort chips re-rank, song links point to `/songs/<slug>`.
Run: `npm run typecheck` → no errors.

- [ ] **Step 3: Commit**

```bash
git add app/songs/page.tsx
git commit -m "feat(songs): /songs sortable index (fancy/functional/minimal)"
```

---

## Task 7: `/songs/[slug]` song page (3 modes)

**Files:**
- Create: `app/songs/[slug]/page.tsx`

**Interfaces:** Consumes `getSongBySlug`, `getSongPerformances`, `SongStat`, `SongPerf`; `FactRibbon`, `PlaysPerYearChart`, `SetPlacementBars`, `GapSparkline`, `PerformanceTable` (Task 5); `Doc`, `Breadcrumb`, `MetaTable`, `DocSection` (existing); `showHref`, `formatShortDate`, `formatDuration`, `RETURN_LABEL`.

- [ ] **Step 1: Implement the page**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/app/_components/container";
import { Doc, Breadcrumb, MetaTable, DocSection } from "@/app/_components/doc";
import { FactRibbon, PlaysPerYearChart, SetPlacementBars, GapSparkline, PerformanceTable } from "@/app/_components/song";
import { getSongBySlug, getSongPerformances, type SongStat } from "@/lib/queries/songs";
import { getExperience } from "@/lib/experience.server";
import { showHref, formatShortDate, formatDuration } from "@/lib/queries/format";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const song = await getSongBySlug(slug);
  if (!song) return { title: "Song not found" };
  return { title: song.name, description: `Goose has played ${song.name} ${song.timesPlayed} times since ${song.debutDate ?? "?"}.` };
}

function facts(song: SongStat) {
  const dur = song.longestSeconds != null ? formatDuration(song.longestSeconds) : "—";
  return [
    { k: "Times played", v: song.timesPlayed },
    { k: "Rotation", v: `${song.rotationPct}%` },
    { k: "Current gap", v: song.currentGap ?? "—" },
    { k: "Avg gap", v: song.avgGap ?? "—" },
    { k: "Longest gap", v: song.longestGap ?? "—" },
    { k: "Debut", v: song.debutDate ? formatShortDate(song.debutDate) : "—" },
    { k: "Last played", v: song.lastPlayedDate ? formatShortDate(song.lastPlayedDate) : "—" },
    { k: "Longest", v: dur },
  ];
}

export default async function SongPage({ params }: Params) {
  const { slug } = await params;
  const song = await getSongBySlug(slug);
  if (!song) notFound();
  const perfs = await getSongPerformances(song.songId);
  const experience = await getExperience();
  const tag = song.isOriginal ? "Original" : `Cover · ${song.originalArtist ?? "trad."}`;

  if (experience === "minimal") {
    return (
      <Container className="py-8">
        <Doc>
          <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { href: "/songs", label: "Songs" }, { label: song.name }]} />
          <h1>{song.name}</h1>
          <p className="doc-crumb">{tag}</p>
          <MetaTable rows={facts(song).map((f) => ({ k: f.k, v: f.v }))} />
          <DocSection title="Plays per year">
            <table className="doc-table"><tbody>{song.playsPerYear.map((y) => <tr key={y.year}><td>{y.year}</td><td className="num">{y.count}</td></tr>)}</tbody></table>
          </DocSection>
          <DocSection title="Longest versions">
            <table className="doc-table"><tbody>{song.longestVersions.map((v) => <tr key={v.showId}><td className="num">{v.trackTime}</td><td><Link href={showHref(v.date, v.order)}>{v.date}</Link></td><td>{v.venue ?? "—"}</td></tr>)}</tbody></table>
          </DocSection>
          <DocSection title={`Every performance · ${perfs.length}`}>
            <table className="doc-table">
              <thead><tr><th>Date</th><th>Venue</th><th>Set</th><th className="num">Gap</th><th className="num">Time</th></tr></thead>
              <tbody>{perfs.map((p) => <tr key={p.uniqueId}><td><Link href={showHref(p.date, p.order)}>{p.date}</Link></td><td>{p.venue ?? "—"}</td><td>{p.setLabel}</td><td className="num">{p.gap ?? "—"}{p.isDustedOff ? " *" : ""}</td><td className="num">{p.trackTime ?? "—"}</td></tr>)}</tbody>
            </table>
            <p className="doc-crumb">* a “Dusted Off” return — gap in this song’s longest 5% (≥15 shows).</p>
          </DocSection>
        </Doc>
      </Container>
    );
  }

  return (
    <>
      <Container className="py-7">
        <Breadcrumb trail={[{ href: "/", label: "Almanac" }, { href: "/songs", label: "Songs" }, { label: song.name }]} />
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 className="font-display text-[2.2rem] font-extrabold leading-none tracking-tight text-ink sm:text-4xl">{song.name}</h1>
          <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-muted">{tag}</span>
        </div>
        <FactRibbon facts={facts(song)} />
        <div className="song-cols mt-6">
          <div className="space-y-7">
            <section><h3 className="mb-2 font-display text-base text-ink">Plays per year</h3><PlaysPerYearChart data={song.playsPerYear} /></section>
            <section><h3 className="mb-2 font-display text-base text-ink">Set placement</h3><SetPlacementBars placement={song.setPlacement} /></section>
            {perfs.length > 1 && <section><h3 className="mb-2 font-display text-base text-ink">Gaps &amp; returns</h3><GapSparkline perfs={perfs} /><p className="mt-2 font-mono text-[0.68rem] text-faint">Orange = a “Dusted Off” return (gap in this song’s longest 5%, ≥15 shows).</p></section>}
            {song.longestVersions.length > 0 && (
              <section><h3 className="mb-2 font-display text-base text-ink">Longest versions</h3>
                <ul className="space-y-1 text-sm">{song.longestVersions.map((v) => <li key={v.showId} className="flex justify-between gap-3"><span className="tabular-nums text-gold">{v.trackTime}</span><Link href={showHref(v.date, v.order)} className="text-muted hover:text-ink">{v.date} · {v.venue ?? "—"}</Link></li>)}</ul>
              </section>
            )}
            {song.topVenues.length > 0 && (
              <section><h3 className="mb-2 font-display text-base text-ink">Top venues</h3>
                <ul className="space-y-1 text-sm">{song.topVenues.map((v) => <li key={v.venueId} className="flex justify-between gap-3"><Link href={`/venues/${v.venueId}`} className="text-muted hover:text-ink">{v.name}</Link><span className="tabular-nums text-faint">{v.count}×</span></li>)}</ul>
              </section>
            )}
          </div>
          <div>
            <h3 className="mb-2 font-display text-base text-ink">Every performance <span className="font-mono text-xs text-faint">· {perfs.length}</span></h3>
            <PerformanceTable perfs={perfs} />
          </div>
        </div>
      </Container>
    </>
  );
}
```

- [ ] **Step 2: Verify** — Visit `/songs/<a real slug>` (find one via `/songs`), and a bad slug → 404. Check the ribbon reflows and the table pins+scrolls at 360px (devtools responsive). Run `npm run typecheck`.

- [ ] **Step 3: Commit**

```bash
git add app/songs/[slug]/page.tsx
git commit -m "feat(songs): /songs/[slug] song page (fancy/functional/minimal)"
```

---

## Task 8: `/stats` hub + the five cuts (3 modes)

**Files:**
- Create: `app/stats/page.tsx`
- Create: `app/stats/[cut]/page.tsx`

**Interfaces:** Consumes `mostPlayed`, `rarities`, `currentGaps`, `debutsByYear`, `recentDebuts`, `setStats`, `SongIndexRow`; `SongIndexTable`, `PlaysPerYearChart`; `Doc`, `Breadcrumb`, `EntityTable`, `DocSection`.

- [ ] **Step 1: Implement the hub `app/stats/page.tsx`**

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/app/_components/container";
import { Doc, Breadcrumb } from "@/app/_components/doc";
import { getExperience } from "@/lib/experience.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stats", description: "Goose by the numbers — most played, rarities, gaps, debuts, and set stats." };

export const CUTS: { slug: string; title: string; blurb: string }[] = [
  { slug: "most-played", title: "Most Played", blurb: "The backbone of the catalog." },
  { slug: "rarities", title: "Rarities", blurb: "One-timers and rare gems." },
  { slug: "current-gaps", title: "Most Overdue", blurb: "In rotation, but missing lately." },
  { slug: "debuts", title: "Debuts", blurb: "What's new, and when." },
  { slug: "set-stats", title: "Set Stats", blurb: "Openers, closers, encores." },
];

export default async function StatsHub() {
  const experience = await getExperience();
  if (experience === "minimal") {
    return (
      <Container className="py-8"><Doc>
        <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { label: "Stats" }]} />
        <h1>Stats</h1>
        <ul>{CUTS.map((c) => <li key={c.slug}><Link href={`/stats/${c.slug}`}>{c.title}</Link> — {c.blurb}</li>)}</ul>
      </Doc></Container>
    );
  }
  return (
    <>
      <header className="relative overflow-hidden border-b border-line"><div className="stage-glow inset-x-0 top-0 h-72" />
        <Container className="relative py-10 sm:py-12"><span className="eyebrow">By the numbers</span>
          <h1 className="mt-3 font-display text-[2.4rem] leading-none tracking-tight text-ink sm:text-5xl">Stats</h1></Container>
      </header>
      <Container className="py-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CUTS.map((c) => (
            <Link key={c.slug} href={`/stats/${c.slug}`} className="surface-card group block p-5 transition hover:border-gold/55">
              <div className="font-display text-lg text-ink group-hover:text-gold">{c.title}</div>
              <p className="mt-1 text-sm text-muted">{c.blurb}</p>
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
```

- [ ] **Step 2: Implement the cut page `app/stats/[cut]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/app/_components/container";
import { Doc, Breadcrumb, EntityTable } from "@/app/_components/doc";
import { SongIndexTable, PlaysPerYearChart } from "@/app/_components/song";
import { CUTS } from "../page";
import { mostPlayed, rarities, currentGaps, debutsByYear, recentDebuts, setStats, type SongIndexRow } from "@/lib/queries/songs";
import { getExperience } from "@/lib/experience.server";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ cut: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { cut } = await params;
  const meta = CUTS.find((c) => c.slug === cut);
  return meta ? { title: `${meta.title} · Stats`, description: meta.blurb } : { title: "Stats" };
}

function yearsFor(rows: SongIndexRow[]): number[] {
  const n = rows[0]?.playsPerYear.length ?? 0;
  const hi = new Date().getUTCFullYear();
  return Array.from({ length: n }, (_, i) => hi - (n - 1) + i);
}

export default async function StatsCut({ params }: Params) {
  const { cut } = await params;
  const meta = CUTS.find((c) => c.slug === cut);
  if (!meta) notFound();
  const experience = await getExperience();
  const minimal = experience === "minimal";
  const crumb = <Breadcrumb trail={[{ href: "/", label: minimal ? "Goose Almanac" : "Almanac" }, { href: "/stats", label: "Stats" }, { label: meta.title }]} />;

  // Song-list cuts share one renderer.
  if (cut === "most-played" || cut === "rarities" || cut === "current-gaps") {
    const rows = cut === "most-played" ? await mostPlayed() : cut === "rarities" ? await rarities() : await currentGaps();
    if (minimal) {
      return <Container className="py-8"><Doc>{crumb}<h1>{meta.title}</h1>
        <EntityTable rows={rows.map((r) => ({ href: `/songs/${r.slug}`, name: r.name, sub: `${r.timesPlayed}×`, count: cut === "current-gaps" ? r.currentGap ?? "—" : r.timesPlayed }))} />
      </Doc></Container>;
    }
    return <StatsShell title={meta.title} blurb={meta.blurb}><SongIndexTable rows={rows} years={yearsFor(rows)} /></StatsShell>;
  }

  if (cut === "debuts") {
    const [byYear, recent] = await Promise.all([debutsByYear(), recentDebuts()]);
    if (minimal) {
      return <Container className="py-8"><Doc>{crumb}<h1>Debuts</h1>
        <table className="doc-table"><thead><tr><th>Year</th><th className="num">Debuts</th></tr></thead><tbody>{byYear.map((y) => <tr key={y.year}><td>{y.year}</td><td className="num">{y.count}</td></tr>)}</tbody></table>
        <h2 className="doc-h2">Recent debuts</h2>
        <EntityTable rows={recent.map((d) => ({ href: `/songs/${d.slug}`, name: d.name, sub: `${d.date}${d.venue ? ` · ${d.venue}` : ""}` }))} />
      </Doc></Container>;
    }
    return <StatsShell title="Debuts" blurb={meta.blurb}>
      <PlaysPerYearChart data={byYear} />
      <ul className="mt-6 space-y-1 text-sm">{recent.map((d) => <li key={d.slug} className="flex justify-between gap-3"><Link href={`/songs/${d.slug}`} className="text-ink hover:text-gold">{d.name}</Link><span className="text-faint">{d.date}{d.venue ? ` · ${d.venue}` : ""}</span></li>)}</ul>
    </StatsShell>;
  }

  // set-stats
  const buckets = await setStats();
  if (minimal) {
    return <Container className="py-8"><Doc>{crumb}<h1>Set Stats</h1>
      {buckets.map((b) => <section key={b.key}><h2 className="doc-h2">{b.label}</h2><EntityTable rows={b.rows.map((r) => ({ href: `/songs/${r.slug}`, name: r.name, count: r.count }))} /></section>)}
    </Doc></Container>;
  }
  return <StatsShell title="Set Stats" blurb={meta.blurb}>
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{buckets.map((b) => (
      <div key={b.key}><h3 className="mb-2 font-display text-base text-ink">{b.label}</h3>
        <ul className="space-y-1 text-sm">{b.rows.map((r) => <li key={r.slug} className="flex justify-between gap-3"><Link href={`/songs/${r.slug}`} className="text-muted hover:text-ink">{r.name}</Link><span className="tabular-nums text-faint">{r.count}</span></li>)}</ul></div>
    ))}</div>
  </StatsShell>;
}

function StatsShell({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (<>
    <header className="relative overflow-hidden border-b border-line"><div className="stage-glow inset-x-0 top-0 h-72" />
      <Container className="relative py-9"><span className="eyebrow"><Link href="/stats" className="hover:text-gold">Stats</Link></span>
        <h1 className="mt-3 font-display text-[2.2rem] leading-none tracking-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-2 font-mono text-xs text-faint">{blurb}</p></Container>
    </header>
    <Container className="py-8">{children}</Container>
  </>);
}
```

> Note: importing `CUTS` from `../page` is intentional — it is a plain const, not the default component. If the linter objects to importing from a route file, move `CUTS` into a tiny `app/stats/cuts.ts` and import from there in both files.

- [ ] **Step 3: Verify** — visit `/stats`, then each `/stats/<cut>`; a bad cut → 404. Check all three modes via the experience switcher. Run `npm run typecheck`.

- [ ] **Step 4: Commit**

```bash
git add app/stats
git commit -m "feat(stats): /stats hub + five cuts (fancy/functional/minimal)"
```

---

## Task 9: Setlist links + Dusted-Off markers + nav

**Files:**
- Modify: `lib/queries/shows.ts` (`SetlistEntry`, `getSetlist`)
- Modify: `app/_components/setlist/{fancy,functional,minimal}.tsx`
- Modify: `app/_components/setlist/{fancy,functional,minimal}.test.tsx`
- Modify: `app/_components/site-header.tsx`, `app/_components/site-footer.tsx`, `app/_components/mobile-nav.tsx`

**Interfaces:**
- `SetlistEntry` gains `gap: number | null` and `isDustedOff: boolean`.
- `getSetlist` populates them via a per-show gap query (reuses the show-sequence + p95 logic).

- [ ] **Step 1: Failing test — `getSetlist` enriches gap/Dusted-Off**

Add to the existing shows query test (find it: `ls lib/queries/*.test.ts db/*.test.ts | xargs grep -l getSetlist`; if none, create `lib/queries/shows.test.ts`). Seed a song with a long gap then a return, assert the returning performance has `isDustedOff === true` and the right `gap`. Use the same fixture shape as Task 1.

```ts
// after seeding a song played at seq 1 then again at seq 20 (>=15 floor, top of its gaps):
const entries = await getSetlist(returnShowId);
const e = entries.find((x) => x.songId === RETURNING_SONG_ID)!;
expect(e.gap).toBe(18);
expect(e.isDustedOff).toBe(true);
```

- [ ] **Step 2: Run it, verify failure** (type error / missing fields).

- [ ] **Step 3: Extend `SetlistEntry` and `getSetlist`**

In `lib/queries/shows.ts`, add to the `SetlistEntry` type: `gap: number | null;` and `isDustedOff: boolean;`. After the existing `getSetlist` select returns `rows`, enrich:

```ts
// compute per-song gap at THIS show + the song's p95 threshold
const gapRows = allRows(await db.execute(sql`
  with show_seq as (
    select s.show_id, row_number() over (order by s.show_date, coalesce(s.show_order,1)) as seq
    from shows s where s.show_date <= current_date and exists (select 1 from performances p where p.show_id = s.show_id)
  ),
  song_show as (select distinct p.song_id, ss.seq, ss.show_id from performances p join show_seq ss on ss.show_id = p.show_id),
  gapped as (select song_id, seq, show_id, seq - lag(seq) over (partition by song_id order by seq) - 1 as gap from song_show),
  thresh as (select song_id, percentile_cont(0.95) within group (order by gap) as p95 from gapped where gap is not null group by song_id)
  select g.song_id, g.gap, t.p95 from gapped g left join thresh t on t.song_id = g.song_id where g.show_id = ${showId}
`));
const bySong = new Map<number, { gap: number | null; p95: number }>();
for (const r of gapRows) bySong.set(Number(r.song_id), { gap: r.gap == null ? null : Number(r.gap), p95: Number(r.p95 ?? 0) });
return rows.map((e) => {
  const info = bySong.get(e.songId);
  const gap = info?.gap ?? null;
  const isDustedOff = gap != null && gap >= 15 && gap >= Math.ceil(info?.p95 ?? 0);
  return { ...e, gap, isDustedOff };
});
```

Add the `allRows` helper to `shows.ts` (copy from `songs.ts`), and `import { sql } from "drizzle-orm"` is already present. (Same-show reprises share the show's gap — acceptable.)

- [ ] **Step 4: Run it, verify pass.** Also update any existing `getSetlist`/`showJsonLd` consumers and tests that construct `SetlistEntry` literals to include the two new fields (the setlist component tests' `entry()` factory — add `gap: null, isDustedOff: false`).

- [ ] **Step 5: Failing tests — setlist variants link + mark**

In `app/_components/setlist/minimal.test.tsx` (and matching fancy/functional tests), add the new fields to the `entry()` factory, then a case:

```tsx
it("links the song and marks a Dusted Off return", () => {
  const html = renderToStaticMarkup(<SetlistMinimal entries={[entry({ song: "Hot Tea", slug: "hot-tea", gap: 52, isDustedOff: true })]} />);
  expect(html).toContain('href="/songs/hot-tea"');
  expect(html).toContain("Dusted Off");
});
```

- [ ] **Step 6: Run them, verify failure.**

- [ ] **Step 7: Update the three setlist variants**

In each, wrap the song name in a link when `e.slug` exists and render the marker. Examples:

`minimal.tsx` — replace `{e.song}` with:
```tsx
{e.slug ? <a href={`/songs/${e.slug}`}>{e.song}</a> : e.song}
{e.isDustedOff ? <span className="doc-crumb"> [{RETURN_LABEL} · {e.gap}]</span> : null}
```
(import `RETURN_LABEL` from `@/lib/queries/format`.)

`functional.tsx` — the song cell:
```tsx
<td className="font-semibold text-ink">
  {r.e.slug ? <a href={`/songs/${r.e.slug}`} className="hover:underline">{r.e.song}</a> : r.e.song}
  {r.e.isDustedOff ? <span className="w2-badge gold ml-2">{RETURN_LABEL} · {r.e.gap}</span> : null}
</td>
```

`fancy.tsx` — replace the `<span className="text-[1.02rem] text-ink">{e.song}</span>` with a `next/link` to `/songs/${e.slug}` (fallback plain span when no slug), and after the jam flame add:
```tsx
{e.isDustedOff && <span className="ml-2 rounded-full border border-gold/40 px-2 py-0.5 align-middle font-mono text-[0.6rem] text-gold">{RETURN_LABEL} · {e.gap}</span>}
```
(import `Link` and `RETURN_LABEL`.)

- [ ] **Step 8: Run the setlist tests, verify pass.**

- [ ] **Step 9: Add nav entries**

In `app/_components/site-header.tsx`, extend `NAV`:
```ts
const NAV = [
  { href: "/shows", label: "Shows" },
  { href: "/songs", label: "Songs" },
  { href: "/stats", label: "Stats" },
  { href: "/on-this-day", label: "On This Day" },
  { href: "/venues", label: "Venues" },
  { href: "/tours", label: "Tours" },
];
```
Mirror the same additions in `app/_components/mobile-nav.tsx` (find its nav array) and add Songs + Stats links to `app/_components/site-footer.tsx` where the other section links live. Confirm each header variant already maps over `NAV` (Fancy/Functional/Minimal all do).

- [ ] **Step 10: Verify + typecheck** — Visit a show page in all three modes: song names link to `/songs/<slug>`; a known bustout shows the `Dusted Off · N` marker. Nav shows Songs + Stats. `npm run typecheck` clean. `npm test` green.

- [ ] **Step 11: Commit**

```bash
git add lib/queries/shows.ts app/_components/setlist app/_components/site-header.tsx app/_components/site-footer.tsx app/_components/mobile-nav.tsx
git commit -m "feat(songs): setlist song links + Dusted Off markers + Songs/Stats nav"
```

---

## Task 10: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full suite + typecheck**

Run: `npm test` → all green. Run: `npm run typecheck` → no errors.

- [ ] **Step 2: Production build (dev server stopped first)**

```bash
pkill -f "next dev" 2>/dev/null; rm -rf .next
npm run build
```
Expected: build succeeds, all new routes compile (`/songs`, `/songs/[slug]`, `/stats`, `/stats/[cut]`).

- [ ] **Step 3: Responsive contract pass at 360px**

`npm run dev`, devtools at 360px width. Confirm on `/songs`, `/songs/[slug]`, `/stats/most-played`: (1) ribbon reflows to 2-up; (2) tables pin the identity column and scroll horizontally with the fade + hint; (3) the song page's two columns stack. No text wraps to a second line in a table cell; no column smooshes. Repeat in Fancy and Functional. Confirm Minimal shows plain tables (no `.song-ppy`/`.song-spark` chart nodes).

- [ ] **Step 4: Smoke the data** — On `/songs?sort=overdue`, top rows are active songs (not one-timers). On `/stats/rarities`, low-play songs. Open a song with a real bustout and confirm the gap sparkline shows an orange bar and the log row says `Dusted Off · N`.

- [ ] **Step 5: Commit any fixes**, then this phase is ready for the finishing-a-development-branch flow.

---

## Self-Review (done at authoring)

- **Spec coverage:** index ✓ (T2/T6), song page ✓ (T1/T7), `/stats` hub + 5 cuts ✓ (T3/T8), Dusted Off relative+floor ✓ (T1, surfaced T7/T9), setlist links + markers ✓ (T9), Minimal=tables ✓ (every page's minimal branch), Fancy/Functional shared body ✓, responsive contract ✓ (T5 CSS, T10 verify), slug backfill ✓ (T4), nav ✓ (T9), Spotify deferred ✓ (not present).
- **Type consistency:** `SongPerf`, `SongStat`, `SongIndexRow`, `SongSort`, `SongFacet` defined in Task 1–2 and consumed unchanged in Tasks 5–9. `RETURN_LABEL` single source in `format.ts`. `gap`/`isDustedOff` added to `SetlistEntry` in Task 9 and the setlist test factory updated in the same task.
- **Known sequencing note:** `lib/queries/songs.ts` imports `setLabel` from `app/_components/setlist/shared` — that file already exists (Phase 1). The dead-local cleanup in Task 6 is called out inline.
