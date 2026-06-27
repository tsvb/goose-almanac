import { describe, it, expect } from "vitest";
import { makeTestDb } from "../../db/testing";
import { runVerify } from "./run";
import {
  upsertArtists, upsertVenues, upsertSongs, upsertShows, upsertPerformances,
} from "../../db/repository";
import type { AppDb } from "../../db/schema";

async function seedMinimal(db: AppDb) {
  await upsertArtists(db, [{ artistId: 1, name: "Goose" }]);
  await upsertVenues(db, [{ venueId: 290, name: "Radio City Music Hall", slug: "rcmh",
    city: "New York", state: "NY", country: "USA", zip: null, capacity: 6000 }]);
  await upsertSongs(db, [{ songId: 1, name: "S", slug: "s", isOriginal: true, originalArtist: null }]);
  await upsertShows(db, [{ showId: 1, showDate: "2014-09-27", artistId: 1, venueId: 290, tourId: null,
    title: null, permalink: "p", showOrder: 1, notes: null, createdAt: null, updatedAt: null }]);
  await upsertPerformances(db, [{ uniqueId: "a", showId: 1, songId: 1, setType: "Set", setNumber: "1",
    position: 1, trackTime: null, transition: ", ", transitionId: 1, isJamchart: false,
    jamchartNotes: null, isReprise: false, isJam: false, isVerified: true, footnote: null }]);
}

describe("runVerify", () => {
  it("reports integrity passing and floors failing on a tiny dataset", async () => {
    const ctx = await makeTestDb();
    await seedMinimal(ctx.db);
    const { results } = await runVerify({ db: ctx.db });
    const byName = Object.fromEntries(results.map((r) => [r.name, r.pass]));
    // Integrity holds on the clean graph:
    expect(byName["performances reference a show"]).toBe(true);
    expect(byName["performances reference a song"]).toBe(true);
    expect(byName["no duplicate (show,set,position)"]).toBe(true);
    expect(byName["earliest show is 2014-09-27"]).toBe(true);
    // Floors fail because this dataset is tiny:
    expect(byName["shows floor"]).toBe(false);
    await ctx.close();
  });
});
