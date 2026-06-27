# Phase 0 — Data Foundation: Design Spec

_Date: 2026-06-26 · Status: approved, ready for implementation planning_

## Context

Goose Almanac is a non-commercial fan site aggregating data and stats about the band
Goose, inspired in spirit by dmbalmanac.com. The full roadmap is five phases (see
[README](../../../README.md)); this spec covers **Phase 0**, the invisible data
foundation that every later phase stands on.

The live-performance record comes from the keyless **elgoose.net v2 API** (the spine),
later enriched by Spotify (Phase 2) and nugs deep-links (Phase 1). Full source analysis
lives in [`docs/research/2026-06-26-data-landscape.md`](../../research/2026-06-26-data-landscape.md).

**Audience:** public but low-key, non-commercial. This fits the elgoose licensing
posture: cache our own copy, attribute prominently, stay non-commercial.

## Goal

A reliable, re-runnable pipeline that fills **our own PostgreSQL database** with Goose's
complete live-performance history from elgoose, **plus automated proof that the data is
correct**. No web UI in this phase — Phase 0 exists to de-risk the project by getting
the data model and ingestion right before anything is built on top.

### Success criteria (definition of done)
1. `npm run sync` populates a local Postgres from the elgoose v2 API, idempotently
   (re-running updates changed rows, never duplicates).
2. `npm run verify` passes: row counts are within tolerance of elgoose's reported counts,
   referential integrity holds, and named spot-checks pass.
3. The full test suite passes offline (no network) against saved fixtures.
4. A developer can clone the repo, start the DB, run `sync`, and get a correct local
   dataset by following the README.

## Scope

**In scope (Phase 0):**
- Project skeleton: Next.js + TypeScript app (the permanent home). Only the data layer
  is implemented now; no pages/routes yet.
- Local PostgreSQL via Docker for development.
- Drizzle schema + migrations for six tables.
- elgoose v2 API client (real User-Agent, envelope handling, retries/backoff).
- Pure mapper functions: raw elgoose rows → our typed model.
- Idempotent upsert sync of **Goose proper** (`artist_id = 1`): songs, venues, tours,
  shows, performances.
- `npm run sync` and `npm run verify` commands.
- Test-first coverage with offline fixtures.

**Out of scope (deferred to their phases):**
- Any web UI / pages / API routes (Phase 1).
- Spotify studio discography (Phase 2); nugs deep-links (Phase 1).
- Side-project artists beyond Goose — Orebolo, Vasudo, etc. (schema-ready, not ingested).
- Automated scheduling/cron (manual `sync` is enough now; a scheduled job comes when we
  deploy).
- `albums`, `jamcharts`-method, `appearances`, `uploads`, `links` endpoints. Jam-chart
  status is captured via the `isjamchart`/`jamchart_notes` fields already on setlist rows.

## Architecture

```
elgoose v2 API ──(fetch, real UA)──▶ API client ──▶ mappers ──▶ upsert ──▶ PostgreSQL
   (source of truth)                  (lib/elgoose)   (pure fns)  (Drizzle)   (our copy)
                                                                                 │
                                              verify ◀──── integrity + counts ───┘
```

- **One-directional sync.** elgoose is read-only source of truth; we never write back.
- **Pure mappers** are the testable core: `(rawRow) => ourRow`, no I/O, fixture-tested.
- **Idempotent upserts** keyed on elgoose stable IDs make `sync` safe to re-run.
- **Full re-sync each run.** At this volume (~853 shows, ~600 songs, ~600 venues, a few
  thousand performance rows) a full pull is a handful of API calls and a few MB — simpler
  and more correct than incremental diffing. Incremental (`updated_at`-based) is a future
  optimization, not needed now.

## Tech stack & tooling

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node 22 + TypeScript | Already installed; one language across pipeline + web app |
| Web framework | Next.js (App Router) | Our permanent home; SSR for shareable show pages later |
| ORM / migrations | Drizzle + drizzle-kit | SQL-first, typed, schema shared by scripts and web app |
| Database (dev) | PostgreSQL 16 via Docker | Real production engine, disposable, reproducible |
| Database (prod) | Hosted Postgres (e.g. Neon free tier) | Added at deploy time, not now |
| Tests | Vitest | Fast, TS-native, fixture-friendly |
| HTTP | global `fetch` | Built into Node 22; no dependency needed |

**Dev DB fallback:** if Docker proves fussy on the machine, fall back to native Postgres
(Homebrew). SQLite is explicitly *not* used, to avoid Postgres-vs-SQLite dialect drift in
later phases.

## Database schema

Six tables, all keyed on elgoose's stable integer IDs (used directly as primary keys so
upserts are trivial and idempotent). Column lists are indicative; exact nullability is
finalized during implementation against live data.

- **`artists`** — `artist_id` (PK), `name`. Seeded with Goose (`artist_id = 1`); present
  so side projects can be added later with no migration.
- **`venues`** — `venue_id` (PK), `name`, `city`, `state`, `country`, `timezone`,
  `capacity` (nullable), `latitude`/`longitude` (nullable; geocoded later if needed).
- **`tours`** — `tour_id` (PK), `name`, `year` (nullable).
- **`songs`** — `song_id` (PK), `name`, `slug`, `is_original` (bool), `original_artist`
  (nullable, for covers).
- **`shows`** — `show_id` (PK), `show_date` (date), `artist_id` (FK), `venue_id` (FK),
  `tour_id` (FK, nullable), `title` (nullable), `permalink`, `show_order` (int),
  `notes` (nullable, the show-level shownote), `created_at`, `updated_at`.
- **`performances`** — `uniqueid` (PK), `show_id` (FK), `song_id` (FK), `set_type`
  (e.g. "Set", "Encore", "Soundcheck"), `set_number`, `position` (int), `track_time`
  (nullable text, e.g. "8:46"), `transition` (text, `", "` vs `" > "`),
  `transition_id` (int), `is_jamchart` (bool), `jamchart_notes` (nullable),
  `is_reprise` (bool), `is_jam` (bool), `is_verified` (bool), `footnote` (nullable).

**Relationships:** `performances → shows → venues/tours/artists`; `performances → songs`.
Foreign keys enforced. Reasonable indexes: `shows.show_date`, `shows.venue_id`,
`shows.tour_id`, `performances.show_id`, `performances.song_id`.

**Source-field mapping** (elgoose → ours, the high-value bits):
`showdate→show_date`, `venuename`/`location` resolved via `venue_id`, `tracktime→track_time`,
`transition→transition`, `isjamchart→is_jamchart`, `jamchart_notes→jamchart_notes`,
`shownotes→shows.notes`, `settype→set_type`, `setnumber→set_number`, `position→position`,
`isoriginal→songs.is_original`, `original_artist→songs.original_artist`.

## The ingestion pipeline

`lib/elgoose/` — the API client and mappers; `scripts/sync.ts` — the orchestrator.

**Client (`lib/elgoose/client.ts`)**
- `fetchMethod(method, opts)` → hits `https://elgoose.net/api/v2/{method}.json` with a
  descriptive `User-Agent` (e.g. `GooseAlmanac/0.1 (+contact)`), parses the
  `{error, error_message, data}` envelope, throws on `error: true` or non-2xx.
- Retry with exponential backoff on transient failures (429/5xx/network); low concurrency;
  polite. Configurable base URL for tests.

**Mappers (`lib/elgoose/mappers.ts`)** — pure functions, no I/O:
- `mapVenue`, `mapTour`, `mapSong`, `mapShow`, `mapPerformance`. Handle elgoose quirks:
  string→bool (`"1"`/`1`/`true`), empty-string→null, numeric coercion, date parsing.

**Sync orchestrator (`scripts/sync.ts`)**
1. Fetch `songs`, `venues` (full lists). Derive `tours` from the `shows`/`setlists`
   feeds (tour fields are inlined; no dedicated needed-for-now `tours` endpoint usage).
2. Fetch `shows` (filter `artist_id = 1`).
3. Fetch `setlists` (all Goose rows) → `performances`.
4. Upsert in FK-safe order: artists → venues → tours → songs → shows → performances.
   Upsert = insert-on-conflict-do-update keyed on the PK id.
5. Log a summary (rows fetched / upserted per table).

## Verification (`scripts/verify.ts`, `npm run verify`)

Run after `sync`; exits non-zero on any failure. Checks:
- **Counts within tolerance** of elgoose's live `metadata`/reported counts
  (≈853 shows, 613 songs, 591 venues) — small tolerance to absorb new shows added
  between research and run.
- **Referential integrity:** every `performance.show_id` resolves to a `show`; every
  `performance.song_id` resolves to a `song`; every `show.venue_id` resolves to a `venue`.
- **Spot-checks (golden records):** `2022-06-24` Radio City returns 15 performances with
  the "first set played acoustic" note; at least one known segue (`" > "`) and one
  jam-chart row exist; earliest *Goose* show is `2014-09-27`.

> **Build note (corrected during implementation):** elgoose's bare list endpoints cap at
> 4000 rows — the sync passes `limit=100000` to pull the full ~7,400 performances. Some
> songs referenced by setlists are missing from `songs.json` (legacy ids), so the sync
> backfills songs from setlist rows. Earliest Goose show is 2014-09-27 (2012-01-12 is a
> non-Goose record); performances floor is 6000 (true count ~7,416). See
> [data-landscape research](../../research/2026-06-26-data-landscape.md).
- **No orphans / no duplicate positions** within a show+set.

## Testing strategy (test-first)

Tests run **offline** against fixtures captured from the live API (saved under
`lib/elgoose/__fixtures__/`). TDD order:
1. **Mappers** — golden raw rows → expected typed rows, including the quirk cases
   (bool coercion, empty→null, segue vs non-segue, cover vs original).
2. **Client envelope parsing** — success envelope, `error: true` envelope, non-2xx,
   retry/backoff (mocked fetch). Asserts the `User-Agent` header is sent.
3. **Upsert idempotency** — running the same fixture batch twice yields identical row
   counts and content (against a test database or a thin repository seam).
4. **Verify checks** — fed known-good and known-bad datasets, pass/fail correctly.

A small number of **live smoke checks** (hitting the real API) may exist but are
skippable/offline-by-default so the suite never depends on the network in CI.

## Risks & mitigations
- **elgoose licensing (biggest risk):** no published reuse license, single maintainer.
  → Attribute prominently in-app and in repo; cache our own copy (resilient if access
  changes); stay non-commercial; reach out to curators for an explicit blessing.
- **Bot-UA 403:** the API rejects naive fetchers. → Always send a real `User-Agent`;
  covered by a client test.
- **Schema drift / nullable surprises:** elgoose fields can be empty strings or absent.
  → Mappers normalize defensively; integrity checks in `verify` catch regressions.
- **Politeness:** → full sync is only a handful of calls; low concurrency, backoff,
  local cache. Never hammer the API in tests (fixtures only).

## Open questions
None blocking. Production hosting (Neon vs other), automated scheduling, and side-project
ingestion are deliberately deferred to later phases.
