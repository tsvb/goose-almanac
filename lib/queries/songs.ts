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

// ── Song Index ────────────────────────────────────────────────────────────────

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

  const orderBy: SQL =
    sort === "rare" ? sql`times_played asc, last_seq desc nulls last` :
    sort === "overdue" ? sql`current_gap desc nulls last, (times_played >= 5) desc` :
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

// ── Song detail ───────────────────────────────────────────────────────────────

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
