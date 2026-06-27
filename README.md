# Goose Almanac

A functional, dynamic almanac for aggregating data and statistics about the band
**Goose** — inspired *in spirit* by [dmbalmanac.com](https://dmbalmanac.com), built on
the modern live-performance record maintained at [elgoose.net](https://elgoose.net).

> Non-commercial fan project. Live-performance data is sourced from the community
> database at elgoose.net, which is cached locally and attributed prominently.

## Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| **0** | **Data Foundation** — sync elgoose → our own database, verified | ✅ done |
| **1** | **Show Browsing & Discovery** — browse shows by year/tour/venue, rich setlist pages (segues, jams, track times), search, "On This Day", upcoming shows | ✅ done |
| 2 | Song Stats & History — per-song pages, gaps/bustouts, debuts, Spotify discography | planned |
| 3 | Jam & Set-Flow Analytics — jam charts, segue networks, era-aware analysis | planned |
| 4 | Personal Fan Tracking — "shows I've seen", personal stats, song life-list | planned |

Each phase has its own design spec under [`docs/superpowers/specs/`](docs/superpowers/specs/).

## Live site & deployment

Runs on **Vercel** (Next.js) reading from **Neon** (managed Postgres), refreshed nightly by a
GitHub Action. See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full runbook.

## Getting started

See [`docs/SETUP.md`](docs/SETUP.md). In short: `npm install`, `npm run db:up`,
`npm run db:migrate`, `npm run sync`, `npm run verify`. Phase 0 currently syncs
~853 shows, ~614 songs, 591 venues, and ~7,400 performances into local Postgres.

## Tech

- **Next.js + TypeScript** — the web app and shared data layer
- **PostgreSQL + Drizzle ORM** — our cached copy of the live-performance record
- **Vitest** — test-first development

## Data sources

See [`docs/research/2026-06-26-data-landscape.md`](docs/research/2026-06-26-data-landscape.md)
for the full landscape. The spine is the keyless [elgoose.net v2 API](https://elgoose.net/api/docs.php).
