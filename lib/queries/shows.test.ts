import { describe, it, expect, afterAll, vi } from "vitest";
import { makeTestDb } from "@/db/testing";
import {
  upsertArtists, upsertVenues, upsertTours, upsertSongs, upsertShows, upsertPerformances,
} from "@/db/repository";

// Redirect the module-level `db` in shows.ts to the PGlite test db.
// vi.mock is hoisted; the lambda captures `_testDb` which is set before any test runs.
let _testDb: Awaited<ReturnType<typeof makeTestDb>>["db"] | null = null;
vi.mock("@/db/client", () => ({
  db: new Proxy({} as Record<string | symbol, unknown>, {
    get(_t, prop) {
      if (!_testDb) throw new Error("Test db not initialised");
      const real = _testDb as unknown as Record<string | symbol, unknown>;
      const val = real[prop];
      return typeof val === "function" ? val.bind(real) : val;
    },
  }),
}));

const ctx = await makeTestDb();
_testDb = ctx.db;
afterAll(() => ctx.close());

const RETURNING_SONG_ID = 800;
const FILLER_SONG_ID = 801;

/**
 * Seed 20 shows on distinct dates.
 * Filler song (801) plays every show so show_seq spans all 20.
 * Returning song (800) plays at show 1 (seq 1) and show 20 (seq 20).
 *   gap = 20 - 1 - 1 = 18; only one gap so p95 = 18; ceil(18) = 18; 18 >= 15 && 18 >= 18 → isDustedOff.
 */
async function seed() {
  await upsertArtists(ctx.db, [{ artistId: 1, name: "Goose" }]);
  await upsertVenues(ctx.db, [{ venueId: 1, name: "The Cap", slug: "cap", city: "Port Chester", state: "NY", country: "USA", zip: null, capacity: 1800 }]);
  await upsertTours(ctx.db, []);
  await upsertSongs(ctx.db, [
    { songId: RETURNING_SONG_ID, name: "Returning Song", slug: "returning-song", isOriginal: true, originalArtist: null },
    { songId: FILLER_SONG_ID, name: "Filler Song", slug: "filler-song", isOriginal: true, originalArtist: null },
  ]);

  // 20 shows on consecutive dates
  const dates = Array.from({ length: 20 }, (_, i) => {
    const d = new Date("2020-01-01");
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  await upsertShows(ctx.db, dates.map((d, i) => ({
    showId: i + 1, showDate: d, artistId: 1, venueId: 1, tourId: null,
    title: null, permalink: `p${i}`, showOrder: 1, notes: null, createdAt: null, updatedAt: null,
  })));

  const perf: any[] = [];
  // Filler song every show (so all 20 shows have performances and appear in show_seq)
  dates.forEach((_, i) => perf.push({
    uniqueId: `f${i}`, showId: i + 1, songId: FILLER_SONG_ID,
    setType: "Set", setNumber: "1", position: 1, trackTime: "5:00",
    transition: null, transitionId: null, isJamchart: false, jamchartNotes: null,
    isReprise: false, isJam: false, isVerified: true, footnote: null,
  }));
  // Returning song: show 1 (seq=1) and show 20 (seq=20) → gap = 18
  [0, 19].forEach((i) => perf.push({
    uniqueId: `r${i}`, showId: i + 1, songId: RETURNING_SONG_ID,
    setType: "Set", setNumber: "1", position: 2, trackTime: "10:00",
    transition: null, transitionId: null, isJamchart: false, jamchartNotes: null,
    isReprise: false, isJam: false, isVerified: true, footnote: null,
  }));
  await upsertPerformances(ctx.db, perf);
}

const returnShowId = 20; // show 20 is where the "return" happens

describe("getSetlist gap + Dusted Off enrichment", () => {
  it("computes gap and marks isDustedOff for a long-absent song", async () => {
    await seed();
    const { getSetlist } = await import("./shows");
    const entries = await getSetlist(returnShowId);
    const e = entries.find((x) => x.songId === RETURNING_SONG_ID)!;
    expect(e).toBeDefined();
    expect(e.gap).toBe(18);
    expect(e.isDustedOff).toBe(true);
  });

  it("non-absent songs have gap=null or isDustedOff=false", async () => {
    const { getSetlist } = await import("./shows");
    // Show 2 has only the filler song (played at show 1 → gap=0, not dusted off)
    const entries = await getSetlist(2);
    const filler = entries.find((x) => x.songId === FILLER_SONG_ID)!;
    expect(filler).toBeDefined();
    expect(filler.isDustedOff).toBe(false);
  });
});
