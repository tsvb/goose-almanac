# Setup

## Prerequisites
- **Node 22+**
- **Docker** (for local Postgres) — or a native Postgres 16

## First run
1. `cp .env.example .env` and adjust if needed (defaults match `docker-compose.yml`).
2. `npm install`
3. `npm run db:up`        — start Postgres (docker compose)
4. `npm run db:migrate`   — create the tables
5. `npm run sync`         — pull Goose data from elgoose.net into Postgres
6. `npm run verify`       — confirm the data is correct

A successful `sync` reports roughly:

```
sync complete: { venues: 591, tours: 43, songs: 614, shows: 853, performances: 7416 }
```

and `verify` ends with `VERIFY OK` (all checks pass). These counts grow over time as
Goose plays more shows.

## Useful commands
- `npm test` — offline test suite (fixtures + in-memory PGlite; no network/DB needed)
- `npm run typecheck` — TypeScript strict check
- `npm run capture-fixtures` — refresh test fixtures from the live API
- `npm run db:down` — stop the database

## Notes on the data source
- The spine is the keyless [elgoose.net v2 API](https://elgoose.net/api/docs.php).
- The bare list endpoints cap at **4000 rows**, so the sync requests a high `limit`
  to pull the full history. Some songs (legacy ids like "Foxy Lady") are referenced by
  setlists but absent from `songs.json`; the sync backfills these from the setlist rows.
- Requests send a descriptive `User-Agent` (configurable via `ELGOOSE_USER_AGENT`) —
  the API returns HTTP 403 to requests without one.

## Data attribution
Live-performance data is sourced from the community database at
[elgoose.net](https://elgoose.net). This is a non-commercial fan project; data is cached
locally and elgoose is credited prominently. See
[`docs/research/2026-06-26-data-landscape.md`](research/2026-06-26-data-landscape.md).
