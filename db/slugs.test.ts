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
