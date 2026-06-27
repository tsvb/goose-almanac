import "dotenv/config";
import { runVerify } from "../lib/verify/run";
import { db, closeDb } from "../db/client";
import type { AppDb } from "../db/schema";

async function main() {
  const { ok, results } = await runVerify({ db: db as unknown as AppDb });
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name} — ${r.detail}`);
  }
  await closeDb();
  if (!ok) { console.error("\nVERIFY FAILED"); process.exit(1); }
  console.log("\nVERIFY OK");
}

main().catch(async (e) => { console.error(e); await closeDb(); process.exit(1); });
