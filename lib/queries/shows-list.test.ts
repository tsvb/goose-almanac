import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { sql } from "drizzle-orm";
import { makeTestDb } from "@/db/testing";
import { upsertArtists, upsertVenues, upsertTours, upsertShows } from "@/db/repository";

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

const TOUR_ID = 9;

async function today(): Promise<string> {
  const res = (await ctx.db.execute(sql`select current_date::text as d`)) as unknown as { rows: { d: string }[] };
  return (Array.isArray(res) ? (res as { d: string }[]) : res.rows)[0].d;
}

beforeAll(async () => {
  await upsertArtists(ctx.db, [{ artistId: 1, name: "Goose" }]);
  await upsertVenues(ctx.db, [{ venueId: 1, name: "The Cap", slug: "cap", city: "Port Chester", state: "NY", country: "USA", zip: null, capacity: 1800 }]);
  await upsertTours(ctx.db, [{ tourId: TOUR_ID, name: "Summer Tour 2021", year: 2021 }]);

  // 6 past stand-alone shows, 2 past tour shows, 1 future show.
  const rows = [
    ...["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-04", "2020-01-05", "2020-01-06"].map((d, i) => ({
      showId: i + 1, showDate: d, tourId: null,
    })),
    { showId: 7, showDate: "2021-06-01", tourId: TOUR_ID },
    { showId: 8, showDate: "2021-06-02", tourId: TOUR_ID },
    { showId: 9, showDate: "2030-01-01", tourId: null },
  ];
  await upsertShows(ctx.db, rows.map((r) => ({
    showId: r.showId, showDate: r.showDate, artistId: 1, venueId: 1, tourId: r.tourId,
    title: null, permalink: `p${r.showId}`, showOrder: 1, notes: null, createdAt: null, updatedAt: null,
  })));
});

describe("findLatestPastShow", () => {
  it("finds the most recent past show across all shows, ignoring the future one", async () => {
    const { findLatestPastShow } = await import("./shows");
    const r = await findLatestPastShow({ dir: "asc", perPage: 50 });
    expect(r).not.toBeNull();
    expect(r!.showId).toBe(8); // 2021-06-02, the latest date <= today
    expect(r!.date).toBe("2021-06-02");
    expect(r!.isToday).toBe(false);
    expect(r!.page).toBe(1); // rank 8 of 9, 50/page
  });

  it("computes the page from rank under asc sorting", async () => {
    const { findLatestPastShow } = await import("./shows");
    const r = await findLatestPastShow({ dir: "asc", perPage: 5 });
    expect(r!.page).toBe(2); // asc rank 8 -> ceil(8/5)
  });

  it("computes the page from rank under desc sorting", async () => {
    const { findLatestPastShow } = await import("./shows");
    const r = await findLatestPastShow({ dir: "desc", perPage: 5 });
    // desc order: 2030(1), 2021-06-02(2) -> ceil(2/5) = 1
    expect(r!.page).toBe(1);
  });

  it("scopes to the active tour filter", async () => {
    const { findLatestPastShow } = await import("./shows");
    const r = await findLatestPastShow({ tourId: TOUR_ID, dir: "asc", perPage: 50 });
    expect(r!.showId).toBe(8);
    expect(r!.page).toBe(1);
  });

  it("returns null when the filter has no past show", async () => {
    const { findLatestPastShow } = await import("./shows");
    const r = await findLatestPastShow({ year: 2030, dir: "asc", perPage: 50 });
    expect(r).toBeNull();
  });

  it("flags a show happening today", async () => {
    const { findLatestPastShow } = await import("./shows");
    const d = await today();
    await upsertShows(ctx.db, [{
      showId: 50, showDate: d, artistId: 1, venueId: 1, tourId: null,
      title: null, permalink: "ptoday", showOrder: 1, notes: null, createdAt: null, updatedAt: null,
    }]);
    const r = await findLatestPastShow({ dir: "asc", perPage: 50 });
    expect(r!.showId).toBe(50);
    expect(r!.date).toBe(d);
    expect(r!.isToday).toBe(true);
  });
});
