# Phase 0 — Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reliable, re-runnable pipeline that syncs Goose's complete live-performance history from the elgoose.net v2 API into our own PostgreSQL database, with automated verification that the data is correct — no web UI.

**Architecture:** A one-directional ETL: a typed elgoose API client fetches each method, pure mapper functions convert raw rows to our domain model, and idempotent chunked upserts (keyed on elgoose's stable IDs) write to Postgres via Drizzle. A separate verify step runs deterministic integrity checks against the database. The whole sync/verify core is dependency-injected (client + db) so it is tested offline against captured fixtures and an in-memory Postgres (PGlite).

**Tech Stack:** Node 22 + TypeScript (strict), Next.js (App Router, skeleton only), Drizzle ORM + drizzle-kit, PostgreSQL 16 (Docker for dev), `postgres` (postgres.js) driver, `@electric-sql/pglite` for in-memory test DB, Vitest, `tsx` for running scripts.

## Global Constraints

- **Node:** 22.x (uses built-in global `fetch`; no HTTP library).
- **TypeScript:** `strict: true`.
- **Goose only:** ingest `artist_id = 1`. Filter shows/setlists by it.
- **Real User-Agent required:** every elgoose request must send a descriptive `User-Agent` header (`GooseAlmanac/0.1 (+https://github.com/…; goose almanac fan project)`). The API returns HTTP 403 to naive fetchers.
- **Tests are offline:** unit/integration tests must not hit the network. Use committed fixtures under `lib/elgoose/__fixtures__/` and PGlite. Any live-API test is `.skip` by default.
- **Insert chunking:** bulk inserts must be chunked at **500 rows** to stay under Postgres' 65535-bind-parameter limit.
- **Source of truth is read-only:** never write back to elgoose. elgoose stable integer IDs are our primary keys.
- **Attribution:** the app and README must prominently credit elgoose.net as the data source; the project is non-commercial.
- **Idempotency:** `npm run sync` must be safe to run repeatedly — upserts, never duplicate inserts.

## File Structure

```
package.json                      # deps + scripts (Task 1)
tsconfig.json                     # strict TS (Task 1)
next.config.ts                    # minimal Next config (Task 1)
vitest.config.ts                  # Vitest config (Task 1)
drizzle.config.ts                 # drizzle-kit config (Task 5)
docker-compose.yml                # local Postgres 16 (Task 1)
.env.example                      # DATABASE_URL + USER_AGENT template (Task 1)
app/
  layout.tsx                      # minimal root layout (Task 1)
  page.tsx                        # placeholder landing + attribution (Task 1, finalized Task 10)
lib/
  util.ts                         # toBool, emptyToNull, chunk (Task 3)
  util.test.ts                    # (Task 3)
  elgoose/
    types.ts                      # raw row types + domain row types + ElgooseClient iface (Task 2)
    __fixtures__/                 # captured real API responses (Task 2)
      songs.json venues.json shows.sample.json setlists.2022-06-24.json
    mappers.ts                    # pure mappers (Task 3)
    mappers.test.ts               # (Task 3)
    client.ts                     # fetchMethod w/ UA, envelope, retry (Task 4)
    client.test.ts                # (Task 4)
  sync/
    run.ts                        # runSync({client, db}) orchestrator core (Task 8)
    run.test.ts                   # (Task 8)
  verify/
    checks.ts                     # pure check functions (Task 7)
    checks.test.ts                # (Task 7)
    run.ts                        # runVerify({db}) DB-backed runner core (Task 9)
    run.test.ts                   # (Task 9)
db/
  schema.ts                       # Drizzle pg-core schema, 6 tables (Task 5)
  client.ts                       # postgres.js drizzle instance for dev/prod (Task 5)
  repository.ts                   # chunked idempotent upserts (Task 6)
  repository.test.ts              # (Task 6)
  testing.ts                      # makeTestDb() PGlite helper (Task 5)
drizzle/                          # generated migration SQL (Task 5)
scripts/
  migrate.ts                      # apply migrations to dev/prod DB (Task 5)
  sync.ts                         # wires real client + real db -> runSync (Task 8)
  verify.ts                       # wires real db -> runVerify, prints, exit code (Task 9)
  capture-fixtures.ts             # one-off: refresh fixtures from live API (Task 2)
```

---

### Task 1: Project scaffolding & toolchain

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `docker-compose.yml`, `.env.example`, `app/layout.tsx`, `app/page.tsx`, `lib/sanity.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working toolchain — `npm test`, `npm run typecheck`, `npm run dev`, and the `db:up`/`db:generate`/`db:migrate`/`sync`/`verify` script names (implemented in later tasks).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "goose-almanac",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "sync": "tsx scripts/sync.ts",
    "verify": "tsx scripts/verify.ts",
    "capture-fixtures": "tsx scripts/capture-fixtures.ts"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "drizzle-orm": "^0.38.0",
    "postgres": "^3.4.5"
  },
  "devDependencies": {
    "@electric-sql/pglite": "^0.2.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "dotenv": "^16.4.0",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` populated, no peer-dependency errors that block install.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "skipLibCheck": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.ts`, `app/layout.tsx`, `app/page.tsx`**

`next.config.ts`:
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

`app/layout.tsx`:
```tsx
export const metadata = { title: "Goose Almanac", description: "Goose live data & stats" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 640 }}>
      <h1>Goose Almanac</h1>
      <p>Live-performance data & stats for the band Goose. Under construction.</p>
      <p style={{ color: "#666", fontSize: "0.9rem" }}>
        Setlist data courtesy of <a href="https://elgoose.net">elgoose.net</a>.
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Create `docker-compose.yml` and `.env.example`**

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: goose
      POSTGRES_PASSWORD: goose
      POSTGRES_DB: goose_almanac
    ports:
      - "5432:5432"
    volumes:
      - ./pgdata:/var/lib/postgresql/data
```

`.env.example`:
```bash
# Local dev database (matches docker-compose.yml)
DATABASE_URL=postgres://goose:goose@localhost:5432/goose_almanac
# Sent on every elgoose API request (the API 403s naive fetchers)
ELGOOSE_USER_AGENT=GooseAlmanac/0.1 (+https://github.com/your/repo; goose almanac fan project)
```

- [ ] **Step 6: Create `vitest.config.ts` and the sanity test**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
```

`lib/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("toolchain sanity", () => {
  it("runs typescript tests", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Run the sanity test and typecheck**

Run: `npm test`
Expected: PASS — 1 test passed.
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TypeScript project and toolchain"
```

---

### Task 2: elgoose raw types & captured fixtures

**Files:**
- Create: `lib/elgoose/types.ts`, `scripts/capture-fixtures.ts`
- Create (generated by the capture script): `lib/elgoose/__fixtures__/songs.json`, `venues.json`, `shows.sample.json`, `setlists.2022-06-24.json`
- Test: `lib/elgoose/types.test.ts`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces:
  - `ElgooseEnvelope<T>` = `{ error: boolean; error_message: string; data: T[] }`
  - Raw types: `RawSong`, `RawVenue`, `RawShow`, `RawSetlistRow`.
  - Domain row types (the exact shapes the DB layer inserts): `VenueRow`, `TourRow`, `SongRow`, `ShowRow`, `PerformanceRow`.
  - `ElgooseClient` interface: `{ fetchMethod<T>(method: string, params?: Record<string, string | number>): Promise<T[]> }`.

- [ ] **Step 1: Create `lib/elgoose/types.ts`**

```ts
// ---- API envelope ----
export interface ElgooseEnvelope<T> {
  error: boolean;
  error_message: string;
  data: T[];
}

// ---- Raw rows (verified field shapes, 2026-06-26) ----
export interface RawSong {
  id: number;            // note: songs.json keys the id as `id`, == setlists.song_id
  name: string;
  slug: string;
  isoriginal: number;    // 0 | 1
  original_artist: string;
}

export interface RawVenue {
  venue_id: number;
  venuename: string;
  city: string;
  state: string;
  country: string;
  zip: string | null;
  capacity: number | null;
  slug: string;
}

export interface RawShow {
  show_id: number;
  showdate: string;       // "YYYY-MM-DD"
  permalink: string;
  artist_id: number;
  showtitle: string;
  venue_id: number;
  tour_id: number;
  tourname: string;
  showorder: number;
  show_year: number;
  created_at: string;
  updated_at: string;
}

export interface RawSetlistRow {
  uniqueid: string;
  show_id: number;
  showdate: string;
  song_id: number;
  songname: string;
  artist_id: number;
  settype: string;        // "Set" | "Encore" | "Soundcheck" | ...
  setnumber: string;      // "1", "2", ...
  position: number;
  tracktime: string;      // "8:46" or ""
  transition_id: number;
  transition: string;     // ", " | " > " | ...
  footnote: string;
  isjamchart: number;
  jamchart_notes: string | null;
  venue_id: number;
  shownotes: string;
  tour_id: number;
  tourname: string;
  show_year?: number;     // setlists use `showyear`; tolerate both
  showyear?: number;
  isverified: number;
  isoriginal: number;
  original_artist: string;
  isreprise: number;
  isjam: number;
}

// ---- Domain rows (what the DB layer inserts; camelCase matches Drizzle columns) ----
export interface VenueRow {
  venueId: number; name: string; slug: string | null;
  city: string | null; state: string | null; country: string | null;
  zip: string | null; capacity: number | null;
}
export interface TourRow { tourId: number; name: string; year: number | null; }
export interface SongRow {
  songId: number; name: string; slug: string | null;
  isOriginal: boolean; originalArtist: string | null;
}
export interface ShowRow {
  showId: number; showDate: string; artistId: number;
  venueId: number | null; tourId: number | null;
  title: string | null; permalink: string | null; showOrder: number | null;
  notes: string | null; createdAt: string | null; updatedAt: string | null;
}
export interface PerformanceRow {
  uniqueId: string; showId: number; songId: number;
  setType: string | null; setNumber: string | null; position: number | null;
  trackTime: string | null; transition: string | null; transitionId: number | null;
  isJamchart: boolean; jamchartNotes: string | null;
  isReprise: boolean; isJam: boolean; isVerified: boolean; footnote: string | null;
}

// ---- Client interface (implemented in client.ts, faked in tests) ----
export interface ElgooseClient {
  fetchMethod<T>(method: string, params?: Record<string, string | number>): Promise<T[]>;
}
```

- [ ] **Step 2: Create `scripts/capture-fixtures.ts`**

```ts
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
```

- [ ] **Step 3: Run the capture script to create fixtures**

Run: `npm run capture-fixtures`
Expected: four files written under `lib/elgoose/__fixtures__/`. (This is the only network step in this task; the resulting files are committed and tests read them offline.)

- [ ] **Step 4: Write the fixture-shape test**

`lib/elgoose/types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import songs from "./__fixtures__/songs.json";
import venues from "./__fixtures__/venues.json";
import setlists from "./__fixtures__/setlists.2022-06-24.json";
import type { ElgooseEnvelope, RawSong, RawVenue, RawSetlistRow } from "./types";

describe("fixtures match expected envelope + key shapes", () => {
  it("songs fixture has id/name/slug", () => {
    const env = songs as ElgooseEnvelope<RawSong>;
    expect(env.error).toBe(false);
    expect(env.data.length).toBeGreaterThan(0);
    const s = env.data[0];
    expect(typeof s.id).toBe("number");
    expect(typeof s.name).toBe("string");
    expect(typeof s.slug).toBe("string");
  });

  it("venues fixture has venue_id/venuename", () => {
    const env = venues as ElgooseEnvelope<RawVenue>;
    expect(typeof env.data[0].venue_id).toBe("number");
    expect(typeof env.data[0].venuename).toBe("string");
  });

  it("setlists fixture for 2022-06-24 is the 15-song acoustic Radio City show", () => {
    const env = setlists as ElgooseEnvelope<RawSetlistRow>;
    expect(env.data.length).toBe(15);
    expect(env.data[0].venuename ?? "").toContain("Radio City");
    expect(env.data[0].shownotes).toContain("acoustic");
  });
});
```
(Note: `venuename` exists on setlist rows; the type already includes the fields used.)

- [ ] **Step 5: Run the test**

Run: `npm test -- lib/elgoose/types.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/elgoose/types.ts lib/elgoose/types.test.ts lib/elgoose/__fixtures__ scripts/capture-fixtures.ts
git commit -m "feat: elgoose raw/domain types + captured API fixtures"
```

---

### Task 3: Utilities & pure mappers

**Files:**
- Create: `lib/util.ts`, `lib/elgoose/mappers.ts`
- Test: `lib/util.test.ts`, `lib/elgoose/mappers.test.ts`

**Interfaces:**
- Consumes: types from `lib/elgoose/types.ts`.
- Produces:
  - `lib/util.ts`: `toBool(v: unknown): boolean`, `emptyToNull(v: string | null | undefined): string | null`, `chunk<T>(arr: T[], size: number): T[][]`.
  - `lib/elgoose/mappers.ts`: `mapVenue(r: RawVenue): VenueRow`, `mapSong(r: RawSong): SongRow`, `mapShow(r: RawShow, notes: string | null): ShowRow`, `mapTour(r: { tour_id: number; tourname: string; show_year?: number; showyear?: number }): TourRow`, `mapPerformance(r: RawSetlistRow): PerformanceRow`.

- [ ] **Step 1: Write failing tests for `lib/util.ts`**

`lib/util.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toBool, emptyToNull, chunk } from "./util";

describe("toBool", () => {
  it("treats 1, '1', true as true and 0, '0', '' as false", () => {
    expect(toBool(1)).toBe(true);
    expect(toBool("1")).toBe(true);
    expect(toBool(true)).toBe(true);
    expect(toBool(0)).toBe(false);
    expect(toBool("0")).toBe(false);
    expect(toBool("")).toBe(false);
    expect(toBool(null)).toBe(false);
  });
});

describe("emptyToNull", () => {
  it("maps empty/undefined to null, keeps real strings", () => {
    expect(emptyToNull("")).toBeNull();
    expect(emptyToNull(undefined)).toBeNull();
    expect(emptyToNull(null)).toBeNull();
    expect(emptyToNull("x")).toBe("x");
  });
});

describe("chunk", () => {
  it("splits into size-bounded groups", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/util.test.ts`
Expected: FAIL — cannot find module `./util`.

- [ ] **Step 3: Implement `lib/util.ts`**

```ts
export function toBool(v: unknown): boolean {
  return v === 1 || v === "1" || v === true;
}

export function emptyToNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null;
  return v.trim() === "" ? null : v;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
```

- [ ] **Step 4: Run util tests**

Run: `npm test -- lib/util.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Write failing tests for mappers**

`lib/elgoose/mappers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mapVenue, mapSong, mapShow, mapTour, mapPerformance } from "./mappers";
import type { RawVenue, RawSong, RawShow, RawSetlistRow } from "./types";

describe("mapVenue", () => {
  it("maps venue fields", () => {
    const raw: RawVenue = { venue_id: 1, venuename: "Madison Theater", city: "Covington",
      state: "KY", country: "USA", zip: "41011", capacity: 1200, slug: "madison-theater" };
    expect(mapVenue(raw)).toEqual({ venueId: 1, name: "Madison Theater", slug: "madison-theater",
      city: "Covington", state: "KY", country: "USA", zip: "41011", capacity: 1200 });
  });
});

describe("mapSong", () => {
  it("uses `id` as songId and coerces isoriginal", () => {
    const raw: RawSong = { id: 400, name: "Turned Clouds", slug: "turned-clouds",
      isoriginal: 1, original_artist: "Goose" };
    expect(mapSong(raw)).toEqual({ songId: 400, name: "Turned Clouds", slug: "turned-clouds",
      isOriginal: true, originalArtist: "Goose" });
  });
  it("maps a cover (isoriginal 0) keeping original_artist", () => {
    const raw: RawSong = { id: 9, name: "Hot Tea", slug: "hot-tea", isoriginal: 0,
      original_artist: "moe." };
    expect(mapSong(raw).isOriginal).toBe(false);
    expect(mapSong(raw).originalArtist).toBe("moe.");
  });
});

describe("mapTour", () => {
  it("maps tour_id/tourname/year (show_year or showyear)", () => {
    expect(mapTour({ tour_id: 29, tourname: "Dripfield Summer Tour 2022", showyear: 2022 }))
      .toEqual({ tourId: 29, name: "Dripfield Summer Tour 2022", year: 2022 });
  });
});

describe("mapShow", () => {
  it("maps show fields and attaches notes; empty title -> null; tour_id 0 -> null", () => {
    const raw: RawShow = { show_id: 1, showdate: "2022-06-24", permalink: "p.html", artist_id: 1,
      showtitle: "", venue_id: 290, tour_id: 0, tourname: "", showorder: 1, show_year: 2022,
      created_at: "2022-01-01 00:00:00", updated_at: "2022-02-01 00:00:00" };
    expect(mapShow(raw, "first set acoustic")).toEqual({ showId: 1, showDate: "2022-06-24",
      artistId: 1, venueId: 290, tourId: null, title: null, permalink: "p.html", showOrder: 1,
      notes: "first set acoustic", createdAt: "2022-01-01 00:00:00", updatedAt: "2022-02-01 00:00:00" });
  });
});

describe("mapPerformance", () => {
  it("maps a setlist row, coercing flags and emptying track time", () => {
    const raw = { uniqueid: "12301", show_id: 1, song_id: 735, settype: "Set", setnumber: "1",
      position: 1, tracktime: "8:46", transition_id: 1, transition: ", ", footnote: "",
      isjamchart: 0, jamchart_notes: null, venue_id: 290, shownotes: "x", tour_id: 29,
      tourname: "t", isverified: 1, isoriginal: 1, original_artist: "", isreprise: 0, isjam: 0,
      showdate: "2022-06-24", songname: "California Magic", artist_id: 1 } as RawSetlistRow;
    expect(mapPerformance(raw)).toEqual({ uniqueId: "12301", showId: 1, songId: 735,
      setType: "Set", setNumber: "1", position: 1, trackTime: "8:46", transition: ", ",
      transitionId: 1, isJamchart: false, jamchartNotes: null, isReprise: false, isJam: false,
      isVerified: true, footnote: null });
  });
  it("maps a segue + jamchart row", () => {
    const raw = { uniqueid: "5", show_id: 1, song_id: 2, settype: "Set", setnumber: "2",
      position: 3, tracktime: "", transition_id: 2, transition: " > ", footnote: "fn",
      isjamchart: 1, jamchart_notes: "huge jam", venue_id: 1, shownotes: "", tour_id: 1,
      tourname: "t", isverified: 1, isoriginal: 1, original_artist: "", isreprise: 0, isjam: 1,
      showdate: "2022-06-24", songname: "Arcadia", artist_id: 1 } as RawSetlistRow;
    const m = mapPerformance(raw);
    expect(m.transition).toBe(" > ");
    expect(m.isJamchart).toBe(true);
    expect(m.jamchartNotes).toBe("huge jam");
    expect(m.trackTime).toBeNull();
    expect(m.isJam).toBe(true);
    expect(m.footnote).toBe("fn");
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npm test -- lib/elgoose/mappers.test.ts`
Expected: FAIL — cannot find module `./mappers`.

- [ ] **Step 7: Implement `lib/elgoose/mappers.ts`**

```ts
import { toBool, emptyToNull } from "../util";
import type {
  RawVenue, RawSong, RawShow, RawSetlistRow,
  VenueRow, SongRow, ShowRow, TourRow, PerformanceRow,
} from "./types";

export function mapVenue(r: RawVenue): VenueRow {
  return {
    venueId: r.venue_id,
    name: r.venuename,
    slug: emptyToNull(r.slug),
    city: emptyToNull(r.city),
    state: emptyToNull(r.state),
    country: emptyToNull(r.country),
    zip: emptyToNull(r.zip),
    capacity: r.capacity ?? null,
  };
}

export function mapSong(r: RawSong): SongRow {
  return {
    songId: r.id,
    name: r.name,
    slug: emptyToNull(r.slug),
    isOriginal: toBool(r.isoriginal),
    originalArtist: emptyToNull(r.original_artist),
  };
}

export function mapTour(r: {
  tour_id: number; tourname: string; show_year?: number; showyear?: number;
}): TourRow {
  return { tourId: r.tour_id, name: r.tourname, year: r.show_year ?? r.showyear ?? null };
}

export function mapShow(r: RawShow, notes: string | null): ShowRow {
  return {
    showId: r.show_id,
    showDate: r.showdate,
    artistId: r.artist_id,
    venueId: r.venue_id || null,
    tourId: r.tour_id || null,
    title: emptyToNull(r.showtitle),
    permalink: emptyToNull(r.permalink),
    showOrder: r.showorder ?? null,
    notes,
    createdAt: emptyToNull(r.created_at),
    updatedAt: emptyToNull(r.updated_at),
  };
}

export function mapPerformance(r: RawSetlistRow): PerformanceRow {
  return {
    uniqueId: r.uniqueid,
    showId: r.show_id,
    songId: r.song_id,
    setType: emptyToNull(r.settype),
    setNumber: emptyToNull(r.setnumber),
    position: r.position ?? null,
    trackTime: emptyToNull(r.tracktime),
    transition: emptyToNull(r.transition),
    transitionId: r.transition_id ?? null,
    isJamchart: toBool(r.isjamchart),
    jamchartNotes: emptyToNull(r.jamchart_notes),
    isReprise: toBool(r.isreprise),
    isJam: toBool(r.isjam),
    isVerified: toBool(r.isverified),
    footnote: emptyToNull(r.footnote),
  };
}
```

- [ ] **Step 8: Run mapper tests**

Run: `npm test -- lib/elgoose/mappers.test.ts`
Expected: PASS — all mapper tests.

- [ ] **Step 9: Commit**

```bash
git add lib/util.ts lib/util.test.ts lib/elgoose/mappers.ts lib/elgoose/mappers.test.ts
git commit -m "feat: utilities and pure elgoose->domain mappers"
```

---

### Task 4: elgoose API client

**Files:**
- Create: `lib/elgoose/client.ts`
- Test: `lib/elgoose/client.test.ts`

**Interfaces:**
- Consumes: `ElgooseEnvelope`, `ElgooseClient` from `types.ts`.
- Produces: `createElgooseClient(opts?: { baseUrl?: string; userAgent?: string; fetchImpl?: typeof fetch; maxRetries?: number }): ElgooseClient`. Its `fetchMethod` builds `"{baseUrl}/{method}.json?{params}"`, sends the `User-Agent`, parses the envelope, throws on `error: true`/non-2xx, and retries transient failures (429/5xx/network) with backoff.

- [ ] **Step 1: Write failing tests**

`lib/elgoose/client.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { createElgooseClient } from "./client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("createElgooseClient.fetchMethod", () => {
  it("returns data[] and sends a User-Agent + correct URL", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: false, error_message: "", data: [{ id: 1 }] }));
    const client = createElgooseClient({ baseUrl: "https://x/api/v2", userAgent: "UA/1", fetchImpl });
    const data = await client.fetchMethod<{ id: number }>("songs", { limit: 5 });
    expect(data).toEqual([{ id: 1 }]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://x/api/v2/songs.json?limit=5");
    expect((init as RequestInit).headers).toMatchObject({ "User-Agent": "UA/1" });
  });

  it("throws when the envelope reports error: true", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: true, error_message: "boom", data: [] }));
    const client = createElgooseClient({ fetchImpl, maxRetries: 0 });
    await expect(client.fetchMethod("songs")).rejects.toThrow(/boom/);
  });

  it("retries on a 503 then succeeds", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ error: false, error_message: "", data: [{ ok: 1 }] }));
    const client = createElgooseClient({ fetchImpl, maxRetries: 2, retryDelayMs: 0 });
    const data = await client.fetchMethod<{ ok: number }>("shows");
    expect(data).toEqual([{ ok: 1 }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries on persistent 500", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 500));
    const client = createElgooseClient({ fetchImpl, maxRetries: 1, retryDelayMs: 0 });
    await expect(client.fetchMethod("shows")).rejects.toThrow(/HTTP 500/);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // initial + 1 retry
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/elgoose/client.test.ts`
Expected: FAIL — cannot find module `./client`.

- [ ] **Step 3: Implement `lib/elgoose/client.ts`**

```ts
import type { ElgooseEnvelope, ElgooseClient } from "./types";

export interface ElgooseClientOptions {
  baseUrl?: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  retryDelayMs?: number;
}

const DEFAULT_BASE = "https://elgoose.net/api/v2";
const DEFAULT_UA = "GooseAlmanac/0.1 (goose almanac fan project)";

function buildUrl(baseUrl: string, method: string, params?: Record<string, string | number>): string {
  const qs = params
    ? "?" + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
    : "";
  return `${baseUrl}/${method}.json${qs}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createElgooseClient(opts: ElgooseClientOptions = {}): ElgooseClient {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE;
  const userAgent = opts.userAgent ?? DEFAULT_UA;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxRetries = opts.maxRetries ?? 3;
  const retryDelayMs = opts.retryDelayMs ?? 500;

  async function fetchMethod<T>(method: string, params?: Record<string, string | number>): Promise<T[]> {
    const url = buildUrl(baseUrl, method, params);
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`HTTP ${res.status} for ${method}`);
          if (attempt < maxRetries) { await sleep(retryDelayMs * (attempt + 1)); continue; }
          throw lastErr;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${method}`);
        const body = (await res.json()) as ElgooseEnvelope<T>;
        if (body.error) throw new Error(`elgoose error for ${method}: ${body.error_message}`);
        return body.data;
      } catch (err) {
        lastErr = err;
        const transient = err instanceof TypeError; // network error
        if (transient && attempt < maxRetries) { await sleep(retryDelayMs * (attempt + 1)); continue; }
        throw err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  return { fetchMethod };
}
```

- [ ] **Step 4: Run client tests**

Run: `npm test -- lib/elgoose/client.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/elgoose/client.ts lib/elgoose/client.test.ts
git commit -m "feat: elgoose v2 API client with UA, envelope parsing, retries"
```

---

### Task 5: Database schema, migrations & test DB helper

**Files:**
- Create: `db/schema.ts`, `db/client.ts`, `db/testing.ts`, `drizzle.config.ts`, `scripts/migrate.ts`
- Generated: `drizzle/` (migration SQL)
- Test: `db/schema.test.ts`

**Interfaces:**
- Consumes: domain row types (column shapes) from Task 2.
- Produces:
  - `db/schema.ts`: exported tables `artists, venues, tours, songs, shows, performances`; type alias `export type AppDb = PgDatabase<any, typeof schema, any>` re-exported for repository typing.
  - `db/client.ts`: `export const db` (postgres.js-backed drizzle instance from `DATABASE_URL`).
  - `db/testing.ts`: `makeTestDb(): Promise<{ db: AppDb; close: () => Promise<void> }>` — a migrated in-memory PGlite database.

- [ ] **Step 1: Create `db/schema.ts`**

```ts
import { pgTable, integer, text, boolean, date, index } from "drizzle-orm/pg-core";
import type { PgDatabase } from "drizzle-orm/pg-core";

export const artists = pgTable("artists", {
  artistId: integer("artist_id").primaryKey(),
  name: text("name").notNull(),
});

export const venues = pgTable("venues", {
  venueId: integer("venue_id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  zip: text("zip"),
  capacity: integer("capacity"),
});

export const tours = pgTable("tours", {
  tourId: integer("tour_id").primaryKey(),
  name: text("name").notNull(),
  year: integer("year"),
});

export const songs = pgTable("songs", {
  songId: integer("song_id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug"),
  isOriginal: boolean("is_original").notNull().default(false),
  originalArtist: text("original_artist"),
});

export const shows = pgTable("shows", {
  showId: integer("show_id").primaryKey(),
  showDate: date("show_date").notNull(),
  artistId: integer("artist_id").notNull().references(() => artists.artistId),
  venueId: integer("venue_id").references(() => venues.venueId),
  tourId: integer("tour_id").references(() => tours.tourId),
  title: text("title"),
  permalink: text("permalink"),
  showOrder: integer("show_order"),
  notes: text("notes"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (t) => ({
  dateIdx: index("shows_date_idx").on(t.showDate),
  venueIdx: index("shows_venue_idx").on(t.venueId),
  tourIdx: index("shows_tour_idx").on(t.tourId),
}));

export const performances = pgTable("performances", {
  uniqueId: text("unique_id").primaryKey(),
  showId: integer("show_id").notNull().references(() => shows.showId),
  songId: integer("song_id").notNull().references(() => songs.songId),
  setType: text("set_type"),
  setNumber: text("set_number"),
  position: integer("position"),
  trackTime: text("track_time"),
  transition: text("transition"),
  transitionId: integer("transition_id"),
  isJamchart: boolean("is_jamchart").notNull().default(false),
  jamchartNotes: text("jamchart_notes"),
  isReprise: boolean("is_reprise").notNull().default(false),
  isJam: boolean("is_jam").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  footnote: text("footnote"),
}, (t) => ({
  showIdx: index("perf_show_idx").on(t.showId),
  songIdx: index("perf_song_idx").on(t.songId),
}));

export type AppDb = PgDatabase<any, Record<string, never>, any>;
```

- [ ] **Step 2: Create `drizzle.config.ts` and `db/client.ts`**

`drizzle.config.ts`:
```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

`db/client.ts`:
```ts
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const sql = postgres(connectionString);
export const db = drizzle(sql, { schema });
export const closeDb = () => sql.end();
```

- [ ] **Step 3: Generate the migration**

Run: `npm run db:generate`
Expected: a `drizzle/0000_*.sql` file plus `drizzle/meta/` created describing the six tables.

- [ ] **Step 4: Create `db/testing.ts` (PGlite migrated DB)**

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import type { AppDb } from "./schema";

export async function makeTestDb(): Promise<{ db: AppDb; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db as any, { migrationsFolder: "./drizzle" });
  return { db: db as unknown as AppDb, close: () => client.close() };
}
```

- [ ] **Step 5: Write the schema test (migrations apply, tables exist & insert works)**

`db/schema.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { makeTestDb } from "./testing";
import * as schema from "./schema";

const ctx = await makeTestDb();
afterAll(() => ctx.close());

describe("schema migrates into PGlite", () => {
  it("can insert and read an artist", async () => {
    await ctx.db.insert(schema.artists).values({ artistId: 1, name: "Goose" });
    const rows = await ctx.db.select().from(schema.artists);
    expect(rows).toEqual([{ artistId: 1, name: "Goose" }]);
  });

  it("has all six tables", async () => {
    const res: any = await ctx.db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`
    );
    const names = (res.rows ?? res).map((r: any) => r.table_name);
    for (const t of ["artists", "performances", "shows", "songs", "tours", "venues"]) {
      expect(names).toContain(t);
    }
  });
});
```

- [ ] **Step 6: Create `scripts/migrate.ts` (apply to dev/prod DB)**

```ts
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const sql = postgres(url, { max: 1 });
await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
await sql.end();
console.log("migrations applied");
```

- [ ] **Step 7: Run the schema test**

Run: `npm test -- db/schema.test.ts`
Expected: PASS — 2 tests (PGlite migrates and accepts inserts).

- [ ] **Step 8: Commit**

```bash
git add db/schema.ts db/client.ts db/testing.ts db/schema.test.ts drizzle.config.ts scripts/migrate.ts drizzle/
git commit -m "feat: drizzle schema, migrations, and PGlite test database helper"
```

---

### Task 6: Repository — chunked idempotent upserts

**Files:**
- Create: `db/repository.ts`
- Test: `db/repository.test.ts`

**Interfaces:**
- Consumes: `AppDb` from `db/schema.ts`; domain row types from Task 2; `chunk` from `lib/util.ts`.
- Produces (all `(db: AppDb, rows: Row[]) => Promise<void>`, chunked at 500, on-conflict-update on the PK):
  `upsertArtists`, `upsertVenues`, `upsertTours`, `upsertSongs`, `upsertShows`, `upsertPerformances`.

- [ ] **Step 1: Write failing idempotency tests**

`db/repository.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { makeTestDb } from "./testing";
import * as schema from "./schema";
import {
  upsertArtists, upsertVenues, upsertTours, upsertSongs, upsertShows, upsertPerformances,
} from "./repository";

const ctx = await makeTestDb();
afterAll(() => ctx.close());

async function seedGraph() {
  await upsertArtists(ctx.db, [{ artistId: 1, name: "Goose" }]);
  await upsertVenues(ctx.db, [{ venueId: 290, name: "Radio City Music Hall", slug: "rcmh",
    city: "New York", state: "NY", country: "USA", zip: null, capacity: 6000 }]);
  await upsertTours(ctx.db, [{ tourId: 29, name: "Dripfield Summer Tour 2022", year: 2022 }]);
  await upsertSongs(ctx.db, [{ songId: 735, name: "California Magic", slug: "california-magic",
    isOriginal: true, originalArtist: null }]);
  await upsertShows(ctx.db, [{ showId: 1, showDate: "2022-06-24", artistId: 1, venueId: 290,
    tourId: 29, title: null, permalink: "p", showOrder: 1, notes: "acoustic",
    createdAt: null, updatedAt: null }]);
  await upsertPerformances(ctx.db, [{ uniqueId: "12301", showId: 1, songId: 735, setType: "Set",
    setNumber: "1", position: 1, trackTime: "8:46", transition: ", ", transitionId: 1,
    isJamchart: false, jamchartNotes: null, isReprise: false, isJam: false, isVerified: true,
    footnote: null }]);
}

describe("repository upserts are idempotent", () => {
  it("running the same seed twice yields one row per table and updates content", async () => {
    await seedGraph();
    // second run with a changed value (capacity) must update, not duplicate
    await upsertVenues(ctx.db, [{ venueId: 290, name: "Radio City Music Hall", slug: "rcmh",
      city: "New York", state: "NY", country: "USA", zip: null, capacity: 5960 }]);
    await seedGraph();

    expect((await ctx.db.select().from(schema.venues)).length).toBe(1);
    expect((await ctx.db.select().from(schema.shows)).length).toBe(1);
    expect((await ctx.db.select().from(schema.performances)).length).toBe(1);

    const venue = (await ctx.db.select().from(schema.venues))[0];
    expect(venue.capacity).toBe(6000); // last seedGraph re-set it to 6000
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- db/repository.test.ts`
Expected: FAIL — cannot find module `./repository`.

- [ ] **Step 3: Implement `db/repository.ts`**

```ts
import { sql } from "drizzle-orm";
import { chunk } from "../lib/util";
import * as schema from "./schema";
import type { AppDb } from "./schema";
import type {
  VenueRow, TourRow, SongRow, ShowRow, PerformanceRow,
} from "../lib/elgoose/types";

const CHUNK = 500;

export async function upsertArtists(db: AppDb, rows: Array<{ artistId: number; name: string }>) {
  for (const part of chunk(rows, CHUNK)) {
    if (part.length === 0) continue;
    await db.insert(schema.artists).values(part)
      .onConflictDoUpdate({ target: schema.artists.artistId, set: { name: sql`excluded.name` } });
  }
}

export async function upsertVenues(db: AppDb, rows: VenueRow[]) {
  for (const part of chunk(rows, CHUNK)) {
    if (part.length === 0) continue;
    await db.insert(schema.venues).values(part).onConflictDoUpdate({
      target: schema.venues.venueId,
      set: {
        name: sql`excluded.name`, slug: sql`excluded.slug`, city: sql`excluded.city`,
        state: sql`excluded.state`, country: sql`excluded.country`, zip: sql`excluded.zip`,
        capacity: sql`excluded.capacity`,
      },
    });
  }
}

export async function upsertTours(db: AppDb, rows: TourRow[]) {
  for (const part of chunk(rows, CHUNK)) {
    if (part.length === 0) continue;
    await db.insert(schema.tours).values(part).onConflictDoUpdate({
      target: schema.tours.tourId,
      set: { name: sql`excluded.name`, year: sql`excluded.year` },
    });
  }
}

export async function upsertSongs(db: AppDb, rows: SongRow[]) {
  for (const part of chunk(rows, CHUNK)) {
    if (part.length === 0) continue;
    await db.insert(schema.songs).values(part).onConflictDoUpdate({
      target: schema.songs.songId,
      set: {
        name: sql`excluded.name`, slug: sql`excluded.slug`,
        isOriginal: sql`excluded.is_original`, originalArtist: sql`excluded.original_artist`,
      },
    });
  }
}

export async function upsertShows(db: AppDb, rows: ShowRow[]) {
  for (const part of chunk(rows, CHUNK)) {
    if (part.length === 0) continue;
    await db.insert(schema.shows).values(part).onConflictDoUpdate({
      target: schema.shows.showId,
      set: {
        showDate: sql`excluded.show_date`, artistId: sql`excluded.artist_id`,
        venueId: sql`excluded.venue_id`, tourId: sql`excluded.tour_id`,
        title: sql`excluded.title`, permalink: sql`excluded.permalink`,
        showOrder: sql`excluded.show_order`, notes: sql`excluded.notes`,
        createdAt: sql`excluded.created_at`, updatedAt: sql`excluded.updated_at`,
      },
    });
  }
}

export async function upsertPerformances(db: AppDb, rows: PerformanceRow[]) {
  for (const part of chunk(rows, CHUNK)) {
    if (part.length === 0) continue;
    await db.insert(schema.performances).values(part).onConflictDoUpdate({
      target: schema.performances.uniqueId,
      set: {
        showId: sql`excluded.show_id`, songId: sql`excluded.song_id`,
        setType: sql`excluded.set_type`, setNumber: sql`excluded.set_number`,
        position: sql`excluded.position`, trackTime: sql`excluded.track_time`,
        transition: sql`excluded.transition`, transitionId: sql`excluded.transition_id`,
        isJamchart: sql`excluded.is_jamchart`, jamchartNotes: sql`excluded.jamchart_notes`,
        isReprise: sql`excluded.is_reprise`, isJam: sql`excluded.is_jam`,
        isVerified: sql`excluded.is_verified`, footnote: sql`excluded.footnote`,
      },
    });
  }
}
```

- [ ] **Step 4: Run repository tests**

Run: `npm test -- db/repository.test.ts`
Expected: PASS — idempotency holds (one row per table, capacity updated).

- [ ] **Step 5: Commit**

```bash
git add db/repository.ts db/repository.test.ts
git commit -m "feat: chunked idempotent upsert repository"
```

---

### Task 7: Verification — pure check functions

**Files:**
- Create: `lib/verify/checks.ts`
- Test: `lib/verify/checks.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions over plain numbers/values).
- Produces:
  - `interface CheckResult { name: string; pass: boolean; detail: string }`
  - `checkFloors(counts: { shows: number; songs: number; venues: number; performances: number }): CheckResult[]` — floors: shows ≥ 800, songs ≥ 600, venues ≥ 580, performances ≥ 10000.
  - `checkIntegrity(orphans: { perfNoShow: number; perfNoSong: number; showNoVenue: number; dupPositions: number }): CheckResult[]` — all must be 0.
  - `checkSpotShow(input: { performanceCount: number; notes: string | null }): CheckResult` — expects 15 performances and notes containing "acoustic".
  - `checkEarliestShow(earliest: string | null): CheckResult` — expects "2012-01-12".
  - `summarize(results: CheckResult[]): { ok: boolean; results: CheckResult[] }`.

- [ ] **Step 1: Write failing tests**

`lib/verify/checks.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  checkFloors, checkIntegrity, checkSpotShow, checkEarliestShow, summarize,
} from "./checks";

describe("checkFloors", () => {
  it("passes when all above floors, fails the low one", () => {
    const ok = checkFloors({ shows: 853, songs: 613, venues: 591, performances: 15000 });
    expect(ok.every((r) => r.pass)).toBe(true);
    const bad = checkFloors({ shows: 10, songs: 613, venues: 591, performances: 15000 });
    expect(bad.find((r) => r.name === "shows floor")!.pass).toBe(false);
  });
});

describe("checkIntegrity", () => {
  it("passes only with zero orphans/dups", () => {
    expect(checkIntegrity({ perfNoShow: 0, perfNoSong: 0, showNoVenue: 0, dupPositions: 0 })
      .every((r) => r.pass)).toBe(true);
    expect(checkIntegrity({ perfNoShow: 3, perfNoSong: 0, showNoVenue: 0, dupPositions: 0 })
      .find((r) => r.name === "performances reference a show")!.pass).toBe(false);
  });
});

describe("checkSpotShow", () => {
  it("passes for 15 acoustic performances", () => {
    expect(checkSpotShow({ performanceCount: 15, notes: "first set acoustic" }).pass).toBe(true);
    expect(checkSpotShow({ performanceCount: 12, notes: "first set acoustic" }).pass).toBe(false);
    expect(checkSpotShow({ performanceCount: 15, notes: null }).pass).toBe(false);
  });
});

describe("checkEarliestShow", () => {
  it("expects 2012-01-12", () => {
    expect(checkEarliestShow("2012-01-12").pass).toBe(true);
    expect(checkEarliestShow("2014-01-01").pass).toBe(false);
  });
});

describe("summarize", () => {
  it("ok only when every result passes", () => {
    expect(summarize([{ name: "a", pass: true, detail: "" }]).ok).toBe(true);
    expect(summarize([{ name: "a", pass: true, detail: "" }, { name: "b", pass: false, detail: "" }]).ok)
      .toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/verify/checks.test.ts`
Expected: FAIL — cannot find module `./checks`.

- [ ] **Step 3: Implement `lib/verify/checks.ts`**

```ts
export interface CheckResult { name: string; pass: boolean; detail: string }

const floor = (name: string, actual: number, min: number): CheckResult => ({
  name, pass: actual >= min, detail: `${actual} (min ${min})`,
});

export function checkFloors(c: { shows: number; songs: number; venues: number; performances: number }): CheckResult[] {
  return [
    floor("shows floor", c.shows, 800),
    floor("songs floor", c.songs, 600),
    floor("venues floor", c.venues, 580),
    floor("performances floor", c.performances, 10000),
  ];
}

const zero = (name: string, n: number): CheckResult => ({ name, pass: n === 0, detail: `${n} offenders` });

export function checkIntegrity(o: {
  perfNoShow: number; perfNoSong: number; showNoVenue: number; dupPositions: number;
}): CheckResult[] {
  return [
    zero("performances reference a show", o.perfNoShow),
    zero("performances reference a song", o.perfNoSong),
    zero("shows reference a venue", o.showNoVenue),
    zero("no duplicate (show,set,position)", o.dupPositions),
  ];
}

export function checkSpotShow(input: { performanceCount: number; notes: string | null }): CheckResult {
  const pass = input.performanceCount === 15 && (input.notes ?? "").toLowerCase().includes("acoustic");
  return { name: "spot-check 2022-06-24 Radio City", pass,
    detail: `${input.performanceCount} performances; notes=${JSON.stringify(input.notes)}` };
}

export function checkEarliestShow(earliest: string | null): CheckResult {
  return { name: "earliest show is 2012-01-12", pass: earliest === "2012-01-12",
    detail: `earliest=${earliest}` };
}

export function summarize(results: CheckResult[]): { ok: boolean; results: CheckResult[] } {
  return { ok: results.every((r) => r.pass), results };
}
```

- [ ] **Step 4: Run check tests**

Run: `npm test -- lib/verify/checks.test.ts`
Expected: PASS — all checks.

- [ ] **Step 5: Commit**

```bash
git add lib/verify/checks.ts lib/verify/checks.test.ts
git commit -m "feat: pure verification check functions"
```

---

### Task 8: Sync orchestrator core + script

**Files:**
- Create: `lib/sync/run.ts`, `scripts/sync.ts`
- Test: `lib/sync/run.test.ts`

**Interfaces:**
- Consumes: `ElgooseClient` (Task 2/4), mappers (Task 3), repository upserts (Task 6), `AppDb` (Task 5), raw types (Task 2).
- Produces: `runSync(deps: { client: ElgooseClient; db: AppDb }): Promise<SyncSummary>` where
  `SyncSummary = { venues: number; tours: number; songs: number; shows: number; performances: number }`.
  Order of writes: artists → venues → tours → songs → shows → performances. Filters shows/setlists to `artist_id === 1`. Derives tours from shows+setlists; derives each show's `notes` from the first setlist row carrying `shownotes`.

- [ ] **Step 1: Write a failing test using a fake client + PGlite**

`lib/sync/run.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { makeTestDb } from "../../db/testing";
import * as schema from "../../db/schema";
import { runSync } from "./run";
import type { ElgooseClient } from "../elgoose/types";

const songs = [{ id: 735, name: "California Magic", slug: "california-magic", isoriginal: 1, original_artist: "Goose" },
               { id: 465, name: "Elizabeth", slug: "elizabeth", isoriginal: 1, original_artist: "Goose" }];
const venues = [{ venue_id: 290, venuename: "Radio City Music Hall", city: "New York", state: "NY",
                  country: "USA", zip: null, capacity: 6000, slug: "rcmh" }];
const shows = [{ show_id: 1, showdate: "2022-06-24", permalink: "p", artist_id: 1, showtitle: "",
                 venue_id: 290, tour_id: 29, tourname: "Dripfield Summer Tour 2022", showorder: 1,
                 show_year: 2022, created_at: "x", updated_at: "y" },
               // a non-Goose row that must be filtered out:
               { show_id: 2, showdate: "2022-07-01", permalink: "p2", artist_id: 7, showtitle: "",
                 venue_id: 290, tour_id: 0, tourname: "", showorder: 1, show_year: 2022,
                 created_at: "x", updated_at: "y" }];
const setlists = [{ uniqueid: "12301", show_id: 1, showdate: "2022-06-24", song_id: 735,
                    songname: "California Magic", artist_id: 1, settype: "Set", setnumber: "1",
                    position: 1, tracktime: "8:46", transition_id: 1, transition: ", ", footnote: "",
                    isjamchart: 0, jamchart_notes: null, venue_id: 290,
                    shownotes: "The entire first set was played acoustic.", tour_id: 29,
                    tourname: "Dripfield Summer Tour 2022", showyear: 2022, isverified: 1,
                    isoriginal: 1, original_artist: "", isreprise: 0, isjam: 0 },
                   { uniqueid: "12302", show_id: 1, showdate: "2022-06-24", song_id: 465,
                    songname: "Elizabeth", artist_id: 1, settype: "Set", setnumber: "1",
                    position: 2, tracktime: "5:15", transition_id: 1, transition: ", ", footnote: "",
                    isjamchart: 0, jamchart_notes: null, venue_id: 290,
                    shownotes: "The entire first set was played acoustic.", tour_id: 29,
                    tourname: "Dripfield Summer Tour 2022", showyear: 2022, isverified: 1,
                    isoriginal: 1, original_artist: "", isreprise: 0, isjam: 0 }];

const fakeClient: ElgooseClient = {
  async fetchMethod<T>(method: string): Promise<T[]> {
    const table: Record<string, unknown[]> = { songs, venues, shows, setlists };
    return (table[method] ?? []) as T[];
  },
};

const ctx = await makeTestDb();
afterAll(() => ctx.close());

describe("runSync", () => {
  it("populates the db, filters to Goose, derives tours + show notes", async () => {
    const summary = await runSync({ client: fakeClient, db: ctx.db });
    expect(summary).toEqual({ venues: 1, tours: 1, songs: 2, shows: 1, performances: 2 });

    const showRows = await ctx.db.select().from(schema.shows);
    expect(showRows.length).toBe(1); // artist_id 7 filtered out
    expect(showRows[0].notes).toContain("acoustic");
    expect(showRows[0].tourId).toBe(29);

    const perf = await ctx.db.select().from(schema.performances);
    expect(perf.length).toBe(2);
  });

  it("is idempotent on a second run", async () => {
    await runSync({ client: fakeClient, db: ctx.db });
    expect((await ctx.db.select().from(schema.performances)).length).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/sync/run.test.ts`
Expected: FAIL — cannot find module `./run`.

- [ ] **Step 3: Implement `lib/sync/run.ts`**

```ts
import type { AppDb } from "../../db/schema";
import type {
  ElgooseClient, RawSong, RawVenue, RawShow, RawSetlistRow, TourRow, ShowRow,
} from "../elgoose/types";
import { mapSong, mapVenue, mapShow, mapTour, mapPerformance } from "../elgoose/mappers";
import {
  upsertArtists, upsertVenues, upsertTours, upsertSongs, upsertShows, upsertPerformances,
} from "../../db/repository";

export interface SyncSummary {
  venues: number; tours: number; songs: number; shows: number; performances: number;
}

const GOOSE = 1;

export async function runSync(deps: { client: ElgooseClient; db: AppDb }): Promise<SyncSummary> {
  const { client, db } = deps;

  const rawSongs = await client.fetchMethod<RawSong>("songs");
  const rawVenues = await client.fetchMethod<RawVenue>("venues");
  const rawShows = (await client.fetchMethod<RawShow>("shows")).filter((s) => s.artist_id === GOOSE);
  const rawSetlists = (await client.fetchMethod<RawSetlistRow>("setlists")).filter((r) => r.artist_id === GOOSE);

  // Derive show notes from the first setlist row that has shownotes.
  const notesByShow = new Map<number, string | null>();
  for (const r of rawSetlists) {
    if (!notesByShow.has(r.show_id) && r.shownotes && r.shownotes.trim() !== "") {
      notesByShow.set(r.show_id, r.shownotes);
    }
  }

  // Derive tours from shows + setlists (only real tours: id > 0 and a name).
  const toursById = new Map<number, TourRow>();
  const collectTour = (tour_id: number, tourname: string, year?: number) => {
    if (tour_id > 0 && tourname && tourname.trim() !== "" && !toursById.has(tour_id)) {
      toursById.set(tour_id, mapTour({ tour_id, tourname, show_year: year }));
    }
  };
  for (const s of rawShows) collectTour(s.tour_id, s.tourname, s.show_year);
  for (const r of rawSetlists) collectTour(r.tour_id, r.tourname, r.show_year ?? r.showyear);

  const venues = rawVenues.map(mapVenue);
  const songs = rawSongs.map(mapSong);
  const tours = [...toursById.values()];
  const shows: ShowRow[] = rawShows.map((s) => mapShow(s, notesByShow.get(s.show_id) ?? null));
  const performances = rawSetlists.map(mapPerformance);

  // FK-safe write order.
  await upsertArtists(db, [{ artistId: GOOSE, name: "Goose" }]);
  await upsertVenues(db, venues);
  await upsertTours(db, tours);
  await upsertSongs(db, songs);
  await upsertShows(db, shows);
  await upsertPerformances(db, performances);

  return {
    venues: venues.length, tours: tours.length, songs: songs.length,
    shows: shows.length, performances: performances.length,
  };
}
```

- [ ] **Step 4: Run sync core tests**

Run: `npm test -- lib/sync/run.test.ts`
Expected: PASS — 2 tests (populate+filter+derive, and idempotency).

- [ ] **Step 5: Implement `scripts/sync.ts` (wire real client + real db)**

```ts
import "dotenv/config";
import { createElgooseClient } from "../lib/elgoose/client";
import { runSync } from "../lib/sync/run";
import { db, closeDb } from "../db/client";
import type { AppDb } from "../db/schema";

async function main() {
  const ua = process.env.ELGOOSE_USER_AGENT;
  const client = createElgooseClient(ua ? { userAgent: ua } : {});
  const summary = await runSync({ client, db: db as unknown as AppDb });
  console.log("sync complete:", summary);
  await closeDb();
}

main().catch(async (e) => { console.error(e); await closeDb(); process.exit(1); });
```

- [ ] **Step 6: Commit**

```bash
git add lib/sync/run.ts lib/sync/run.test.ts scripts/sync.ts
git commit -m "feat: dependency-injected sync orchestrator + sync script"
```

---

### Task 9: Verify runner core + script

**Files:**
- Create: `lib/verify/run.ts`, `scripts/verify.ts`
- Test: `lib/verify/run.test.ts`

**Interfaces:**
- Consumes: pure checks (Task 7), `AppDb` (Task 5), schema (Task 5).
- Produces: `runVerify(deps: { db: AppDb }): Promise<{ ok: boolean; results: CheckResult[] }>` — runs SQL counts/integrity queries against the DB and feeds the pure checks.

- [ ] **Step 1: Write a failing test against a seeded PGlite DB**

`lib/verify/run.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
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
  await upsertShows(db, [{ showId: 1, showDate: "2012-01-12", artistId: 1, venueId: 290, tourId: null,
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
    expect(byName["earliest show is 2012-01-12"]).toBe(true);
    // Floors fail because this dataset is tiny:
    expect(byName["shows floor"]).toBe(false);
    await ctx.close();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/verify/run.test.ts`
Expected: FAIL — cannot find module `./run`.

- [ ] **Step 3: Implement `lib/verify/run.ts`**

```ts
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
```

- [ ] **Step 4: Run verify runner tests**

Run: `npm test -- lib/verify/run.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `scripts/verify.ts`**

```ts
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
```

- [ ] **Step 6: Commit**

```bash
git add lib/verify/run.ts lib/verify/run.test.ts scripts/verify.ts
git commit -m "feat: DB-backed verify runner + verify script"
```

---

### Task 10: Live end-to-end run, attribution & setup docs (Phase 0 completion)

**Files:**
- Modify: `README.md` (setup/run instructions, attribution), `app/page.tsx` (attribution already present — confirm)
- Create: `docs/SETUP.md`

**Interfaces:**
- Consumes: everything. This task proves the whole pipeline works against the real API + real Postgres and documents how to run it.

- [ ] **Step 1: Start the dev database**

Run: `cp .env.example .env` (if `.env` not present), then `npm run db:up`
Expected: `docker compose` starts a `postgres:16` container; `docker compose ps` shows it healthy on 5432.
(If Docker is unavailable, start a native Postgres and set `DATABASE_URL` accordingly — fallback per the spec.)

- [ ] **Step 2: Apply migrations**

Run: `npm run db:migrate`
Expected: prints `migrations applied`.

- [ ] **Step 3: Run the real sync**

Run: `npm run sync`
Expected: prints `sync complete: { venues: ~591, tours: >0, songs: ~613, shows: ~853, performances: >10000 }` (numbers grow over time; they should be in these ranges, not zero).

- [ ] **Step 4: Run verify against the real data**

Run: `npm run verify`
Expected: every line `PASS`, final `VERIFY OK`, exit code 0. Specifically the 2022-06-24 spot-check and `earliest show is 2012-01-12` pass.

- [ ] **Step 5: Run the full offline test suite + typecheck**

Run: `npm test` then `npm run typecheck`
Expected: all tests PASS with no network; typecheck clean.

- [ ] **Step 6: Write `docs/SETUP.md`**

```markdown
# Setup

## Prerequisites
- Node 22+
- Docker (for local Postgres) — or a native Postgres 16

## First run
1. `cp .env.example .env` and adjust if needed.
2. `npm install`
3. `npm run db:up`        # start Postgres (docker compose)
4. `npm run db:migrate`   # create tables
5. `npm run sync`         # pull Goose data from elgoose.net into Postgres
6. `npm run verify`       # confirm the data is correct

## Useful commands
- `npm test` — offline test suite (fixtures + PGlite)
- `npm run capture-fixtures` — refresh test fixtures from the live API
- `npm run db:down` — stop the database

## Data attribution
Live-performance data is sourced from the community database at
[elgoose.net](https://elgoose.net) via its public v2 API. This is a
non-commercial fan project; data is cached locally and elgoose is credited
prominently. See `docs/research/2026-06-26-data-landscape.md`.
```

- [ ] **Step 7: Update `README.md` setup section**

Add a "## Getting started" section linking to `docs/SETUP.md` and flip the Phase 0 status in the roadmap table from "🔨 in progress" to "✅ done".

- [ ] **Step 8: Commit**

```bash
git add README.md docs/SETUP.md app/page.tsx
git commit -m "docs: Phase 0 setup guide, attribution, and completion status"
```

---

## Self-Review

**1. Spec coverage:**
- Project skeleton (Next.js + TS) → Task 1. ✓
- Local Postgres via Docker → Task 1 (`docker-compose.yml`), Task 10 (run). ✓
- Drizzle schema (6 tables) + migrations → Task 5. ✓
- elgoose client (real UA, envelope, retry) → Task 4. ✓
- Pure mappers (quirks: bool coercion, empty→null, segue, cover) → Task 3. ✓
- Idempotent chunked upserts (Goose only) → Task 6 (chunk+upsert), Task 8 (filter artist_id=1). ✓
- `npm run sync` / `npm run verify` → Tasks 8/9. ✓
- Verification (counts/floors, referential integrity, spot-checks, earliest, dup positions) → Tasks 7/9. ✓
- Test-first, offline fixtures + PGlite → every task; fixtures Task 2; PGlite Task 5. ✓
- Tours derived from inlined fields (no tours endpoint) → Task 8. ✓
- Deferrals (Spotify, nugs, albums, side projects, scheduling) → not implemented, by design. ✓

**2. Placeholder scan:** No TBD/TODO; every code step has complete code; every run step has a command + expected output. ✓

**3. Type consistency:** Domain row types defined once in `lib/elgoose/types.ts` (Task 2) and consumed unchanged by mappers (Task 3), repository (Task 6), and sync (Task 8). `AppDb` defined in `db/schema.ts` (Task 5) and used by `db/testing.ts`, repository, sync, verify. `ElgooseClient` defined in Task 2, implemented in Task 4, faked in Task 8. `CheckResult` defined in Task 7, consumed in Task 9. Upsert function names (`upsertVenues` etc.) consistent between Tasks 6, 8, 9. `runSync`/`runVerify` signatures consistent between core and script tasks. ✓

No issues found requiring changes.
```
