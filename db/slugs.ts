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
