# Goose Almanac — Data Landscape Research

_Researched 2026-06-26. Facts verified against live endpoints where noted._

This file preserves the source-of-truth research that informs every phase of the
project. Update it as we learn more or as sources change.

> **Build-time corrections (verified while building Phase 0, 2026-06-26):**
> - **Bare list endpoints cap at 4000 rows.** `setlists.json` (and other `{method}.json`
>   calls) return at most 4000 rows by default; pass `?limit=100000` to get the full set
>   (~9,421 setlist rows total, ~7,416 for Goose). The sync does this.
> - **`songs.json` is incomplete.** It returns 613 songs with ids 400–1028, but setlists
>   reference legacy ids outside that range (e.g. `song_id=1` = "Foxy Lady"). The sync
>   backfills missing songs from the setlist rows.
> - **Earliest *Goose* (artist_id=1) show is `2014-09-27`,** not 2012-01-12. The 2012 date
>   is the earliest record across *all* artists in elgoose (a non-Goose/related act). The
>   `?artist_id=1` query param is ignored by the API; only the path form `/artist_id/1`
>   filters server-side. We filter client-side.

## Summary / bottom line

- **The spine is the elgoose.net v2 API** — free, keyless, JSON, deeply structured.
  Build the entire core on it.
- **Nice-to-haves, layered later:** Spotify (studio discography art/track lengths,
  Phase 2), nugs.net deep-links ("listen to this show", Phase 1), official site links.
- **setlist.fm** is a redundant, shallower cross-check — not needed.
- **Biggest risk:** elgoose has **no published data-reuse/commercial license** and a
  single maintainer. Mitigations: attribute prominently, cache our own copy, stay
  non-commercial, and proactively contact the curators for a blessing.

## 1. elgoose.net — THE SPINE

- **Docs:** https://elgoose.net/api/docs.php — current version **v2**, base URL
  `https://elgoose.net/api/v2`.
- **Auth:** none (no key/token).
- **Format:** clean JSON (`.json`) or HTML (`.html`). Envelope:
  `{"error": false, "error_message": "", "data": [...]}`. Stable integer IDs.
- **Request shapes:**
  - All rows: `/v2/{method}.{format}`
  - By id: `/v2/{method}/{id}.{format}`
  - By field: `/v2/{method}/{column}/{value}.{format}` (e.g.
    `/v2/setlists/showdate/2022-06-24.json`)
  - Params: `order_by`, `direction` (asc/desc), `limit`, `show_tag`.
- **Methods:** `setlists`, `latest`, `shows`, `songs`, `venues`, `jamcharts`,
  `albums`, `metadata`, `links`, `uploads`, `appearances`, `list`.
- **Engine:** "Powered by Songfish" — same lineage as Phish.net's v5 API, so the data
  model mirrors api.phish.net. Be polite (cache, low concurrency) even though no limit
  is enforced.
- **⚠️ Bot-UA 403:** the *website* (and naive fetchers) get HTTP 403. The **API works
  fine with a real `User-Agent` header.** Our client must send one.

### Verified counts (as of research date)
- **1,185** total show records; **853 are Goose proper** (`artist_id = 1`). The rest are
  tracked side projects: Orebolo (35, the Goose acoustic trio), Vasudo (30),
  Great Blue (19), Nico Suave and the Mothership (19), Cotter + Friends (15),
  Duane Betts & Palmetto Motel (14), Dobbs' Dead (12), etc.
- **613** songs, **591** venues, **756** jamchart entries.
- Date range: **2012-01-12** (earliest) through scheduled shows into **late 2026**.
  Sparse 2012–2016; densifies from late 2017 (Anspach joins) onward.

### Verified field shapes (live, 2026-06-26)
`shows` row keys: `show_id, showdate, showtime, permalink, artist_id, artist,
showtitle, venue_id, venuename, location, city, state, country, timezone, tour_id,
tourname, showorder, show_year, show_day, show_dayname, show_month, show_monthname,
updated_at, created_at, show_tags`.

`setlists` row keys (one row = one song performance): `uniqueid, show_id, showdate,
showtime, showtitle, artist, song_id, songname, artist_id, permalink, settype,
setnumber, position, tracktime, transition_id, transition, footnote, footnotes,
isjamchart, jamchart_notes, venue_id, shownotes, showyear, showorder, opener, tour_id,
tourname, soundcheck, isverified, slug, isoriginal, original_artist, venuename, city,
state, country, timezone, isreprise, isjam, css_class, isrecommended`.

Spot-check: `GET /v2/setlists/showdate/2022-06-24.json` → 15 rows, Radio City Music
Hall, with shownote "The entire first set was played acoustic. Peter played a grand
piano for this show." `transition` is `", "` for no-segue and `" > "` for a segue.

## 2. setlist.fm — secondary cross-check (not used)
- REST API `https://api.setlist.fm/rest/1.0/`, free key (header `x-api-key`),
  non-commercial. ~795 Goose setlists, shallower than elgoose (no track times, weaker
  segues). Redundant; skip unless we need a fallback.

## 3. nugs.net — official live audio (deep-link only) — Phase 1 nice-to-have
- No public API. Catalog at `nugs.net/goose-...`. Undocumented internal JSON at
  `streamapi.nugs.net/api.aspx` (fragile, may change). **Safe pattern: deep-link to a
  show's nugs page** keyed by date/venue. Don't scrape/redistribute audio or metadata.

## 4. Spotify Web API — studio discography — Phase 2 nice-to-have
- **Goose (Connecticut) artist ID: `5tkITWzssc9z9hu7ZEOCXz`** (top tracks: So Ready,
  Hungersite, Arcadia). ⚠️ `3gAnduA93Ykv75yNrwXhz5` is a *different Belgian band* also
  named Goose — do not use it.
- **Client Credentials** OAuth (app-only). Endpoints: `/v1/artists/{id}`,
  `/artists/{id}/albums`, `/albums/{id}/tracks`, `/tracks/{id}`. Display-only terms.
- ⚠️ audio-features / audio-analysis endpoints **deprecated for new apps (Nov 2024)** —
  no tempo/energy/valence. We get art, track lengths, popularity, release metadata.

## 5. Official Goose sources (links only)
- goosetheband.com — tour page + social links, **no API / structured feed**. Use
  elgoose's scheduled shows for upcoming dates. Corroborates current lineup.

## 6. Existing Goose stats sites (learn, don't duplicate)
- elgoose.net's own `/stats/` + chart suite (Debut/Tease/Opener/Longest Version/20+ Min
  Jam) — strong data, utilitarian/dated UX.
- setlist.fm tour stats (broad, shallow). Phantasy Tour (older-school). kworb/
  musicmetricsvault (Spotify streaming reference).
- **White space:** a modern, fast, visually polished almanac combining elgoose's deep
  setlist/jam data with discography + listen deep-links, good search, and gap/jam
  visualizations. No one does this well today.

## Band facts (verified) — relevant to data modeling

**Current lineup (4-piece):** Rick Mitarotonda (guitar, vocals), Trevor Weekz (bass,
vocals), Peter Anspach (keys, guitar, vocals — joined late 2017), Cotter Ellis (drums,
vocals — joined 2024-02-05).

**Lineup-change history (matters for "era"-aware analysis in Phase 3):**
- Ben Atkind — drums (2014–2023), founding drummer; departed 2023-12-22.
- Cotter Ellis — drums (joined 2024-02-05).
- Jeff Arevalo — percussion/drums/vocals (2020–2025); announced hiatus 2025-02-03,
  permanently removed 2025-03-23. So 2020–early-2025 shows were effectively a five-piece.
- Earlier formers: Ben Teeters, Isaac Slutzky, Peter Castaldi, Chris "Doc" Capozzoli,
  Patrick "Butters" Carr, Kris Yunker, Aaron Hagele.

**Studio discography:** Moon Cabin (2016), Shenanigans Nite Club (2021), Dripfield
(2022), Everything Must Go (2025-04-25), Chain Yer Dragon (2025-08), Big Modern!
(2026-06-12). Distinguish studio vs live albums in any discography model.

**Formation / tracked era:** formed 2014 (Wilton/Norwalk, CT). Treat **~2017–2018
onward** as the statistically meaningful era; pre-2017 shows exist but are thin.
