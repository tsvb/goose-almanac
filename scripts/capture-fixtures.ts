import { writeFile, mkdir } from "node:fs/promises";

const UA = "GooseAlmanac/0.1 (fixture capture; goose almanac fan project)";
const BASE = "https://elgoose.net/api/v2";
const DIR = "lib/elgoose/__fixtures__";

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}/${path}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

async function main() {
  await mkdir(DIR, { recursive: true });
  const targets: Array<[string, string]> = [
    ["songs.json", "songs.json"],
    ["venues.json", "venues.json"],
    ["shows.json?artist_id=1&limit=5&order_by=showdate&direction=desc", "shows.sample.json"],
    ["setlists/showdate/2022-06-24.json", "setlists.2022-06-24.json"],
  ];
  for (const [path, file] of targets) {
    const json = await get(path);
    await writeFile(`${DIR}/${file}`, JSON.stringify(json, null, 1));
    console.log(`wrote ${DIR}/${file}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
