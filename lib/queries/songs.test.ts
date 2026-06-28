import { describe, it, expect, afterAll, vi } from "vitest";
import { makeTestDb } from "@/db/testing";
import {
  upsertArtists, upsertVenues, upsertTours, upsertSongs, upsertShows, upsertPerformances,
} from "@/db/repository";
import { p95, isDustedOffGap } from "./songs";

// Redirect the module-level `db` in songs.ts to the PGlite test db.
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

const ctx = await makeTestDb();
_testDb = ctx.db;
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
