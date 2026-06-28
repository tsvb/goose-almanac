import { db } from "@/db/client";
import { ensureSongSlugs } from "@/db/slugs";

const n = await ensureSongSlugs(db as never);
console.log(`ensureSongSlugs: updated ${n} song slugs`);
process.exit(0);
