# Handoff — Goose Almanac

_Last updated: 2026-06-27 (end of session)_

## Where things stand

**Phases 0 and 1 are complete and merged to `main`** (clean tree, 30/30 tests passing,
production build succeeds).

- **Phase 0 — Data Foundation:** elgoose v2 API → local PostgreSQL. Pipeline (`npm run sync`)
  + verification (`npm run verify`). Currently **853 shows, 7,416 performances, 614 songs,
  591 venues** in the DB.
- **Phase 1 — Show Browsing & Discovery:** the full Next.js site (the "Almanac" design
  system + 11 routes). Reviewed (opus): READY TO MERGE, zero critical/important findings.

## How to resume

```bash
npm run db:up        # start Postgres (docker compose) — data persists in ./pgdata
npm run dev          # dev server → http://localhost:3000
# if the data ever looks stale or empty:
npm run db:migrate   # (only needed on a fresh DB)
npm run sync         # re-pull from elgoose
npm run verify       # confirm integrity (expects VERIFY OK)
npm test             # offline suite (30/30)
npm run typecheck    # tsc --noEmit, clean
```

The Postgres container (`goosealmanac-db-1`) was left **running**. Stop it with
`npm run db:down` if you like; the data survives. The dev server was stopped at end of session.

## Key routes to look at

- `/` home · `/shows` browse (year/sort/paginate) · **`/shows/2025-06-28`** (best setlist
  demo — segue threads + jam flames at MSG) · `/shows/2022-06-24` (acoustic Radio City,
  "from the notes") · `/venues` · `/tours` · `/on-this-day` · `/search?q=red+rocks`

## Next up — Phase 2: Song Stats & History

Per the roadmap. This is where the setlist song names become links into their own pages:
- Per-song pages: times played, **debut**, last-played, **longest gaps / bustouts**,
  longest versions, every performance.
- Song leaderboards / browse-by-song.
- Spotify studio discography (artist id `5tkITWzssc9z9hu7ZEOCXz`, Client Credentials —
  see `docs/research/2026-06-26-data-landscape.md`).

Follow the same flow: brainstorm → spec → plan → build, surfacing the UI visually.

## Deferred / known-small items (none blocking)

- **Song links** in setlists are plain text today — they light up in Phase 2.
- **Map view** for venues needs lat/lng (a geocoding enrichment step) — deferred.
- **nugs.net "listen" deep-links** and **OG share images** — deferred (Phase 1 spec notes).
- Show-page footnotes show as `°` with hover text; a full footnote apparatus could be added.
- `/shows` default sort leads with future (unplayed) dates marked "—"; fine, revisit if desired.

## Gotchas worth remembering

- **Never run `npm run build` while `npm run dev` is running** — it clobbers the dev
  server's `.next` chunks (MODULE_NOT_FOUND 500s). Stop dev first, or `rm -rf .next` and
  restart dev afterward.
- elgoose returns some text **HTML-encoded** (`&amp;`); the mappers decode it. If you add
  new text fields, decode them too (`decodeEntities` in `lib/util.ts`), and don't trim the
  segue transition `" > "`.
- elgoose **bare list endpoints cap at 4,000 rows** — the sync passes `limit=100000`.
- Home stat "shows played" (≈817) < total shows (853) because 36 are future scheduled dates.

## Map of the code

- `db/` — Drizzle schema, client, migrations, repository (Phase 0).
- `lib/elgoose/` — API client + mappers · `lib/sync/`, `lib/verify/` — pipeline + checks.
- `lib/queries/` — all page data access (typed Drizzle functions; no SQL in pages).
- `app/_components/` — design system (header/footer, Setlist, ShowCard/ShowRow, marks, etc.).
- `app/**/page.tsx` — the routes. `app/globals.css` — design tokens + theme.
- `docs/superpowers/specs/` — design specs for each phase. `docs/research/` — data-source notes.
