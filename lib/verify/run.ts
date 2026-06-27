import { sql } from "drizzle-orm";
import type { AppDb } from "../../db/schema";
import {
  checkFloors, checkIntegrity, checkSpotShow, checkEarliestShow, summarize, type CheckResult,
} from "./checks";

async function scalar(db: AppDb, q: ReturnType<typeof sql>): Promise<number> {
  const res: any = await db.execute(q);
  const rows = res.rows ?? res;
  return Number(rows[0]?.n ?? 0);
}

async function text(db: AppDb, q: ReturnType<typeof sql>): Promise<string | null> {
  const res: any = await db.execute(q);
  const rows = res.rows ?? res;
  const v = rows[0]?.v;
  return v == null ? null : String(v);
}

export async function runVerify(deps: { db: AppDb }): Promise<{ ok: boolean; results: CheckResult[] }> {
  const { db } = deps;

  const counts = {
    shows: await scalar(db, sql`select count(*)::int as n from shows`),
    songs: await scalar(db, sql`select count(*)::int as n from songs`),
    venues: await scalar(db, sql`select count(*)::int as n from venues`),
    performances: await scalar(db, sql`select count(*)::int as n from performances`),
  };

  const orphans = {
    perfNoShow: await scalar(db, sql`select count(*)::int as n from performances p
      left join shows s on s.show_id = p.show_id where s.show_id is null`),
    perfNoSong: await scalar(db, sql`select count(*)::int as n from performances p
      left join songs g on g.song_id = p.song_id where g.song_id is null`),
    showNoVenue: await scalar(db, sql`select count(*)::int as n from shows s
      where s.venue_id is not null and not exists
        (select 1 from venues v where v.venue_id = s.venue_id)`),
    dupPositions: await scalar(db, sql`select count(*)::int as n from (
      select show_id, set_number, position from performances
      group by show_id, set_number, position having count(*) > 1) d`),
  };

  const spotCount = await scalar(db, sql`select count(*)::int as n from performances p
    join shows s on s.show_id = p.show_id where s.show_date = '2022-06-24'`);
  const spotNotes = await text(db, sql`select notes as v from shows where show_date = '2022-06-24' limit 1`);
  const earliest = await text(db, sql`select min(show_date)::text as v from shows`);

  const results: CheckResult[] = [
    ...checkFloors(counts),
    ...checkIntegrity(orphans),
    checkSpotShow({ performanceCount: spotCount, notes: spotNotes }),
    checkEarliestShow(earliest),
  ];
  return summarize(results);
}
