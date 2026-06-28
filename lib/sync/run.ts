import type { AppDb } from "../../db/schema";
import type {
  ElgooseClient, RawSong, RawVenue, RawShow, RawSetlistRow, TourRow, ShowRow, SongRow,
} from "../elgoose/types";
import { mapSong, mapVenue, mapShow, mapTour, mapPerformance, mapSongFromSetlist } from "../elgoose/mappers";
import {
  upsertArtists, upsertVenues, upsertTours, upsertSongs, upsertShows, upsertPerformances,
} from "../../db/repository";
import { ensureSongSlugs } from "../../db/slugs";

export interface SyncSummary {
  venues: number; tours: number; songs: number; shows: number; performances: number;
}

const GOOSE = 1;

export async function runSync(deps: { client: ElgooseClient; db: AppDb }): Promise<SyncSummary> {
  const { client, db } = deps;

  // High limit defeats the elgoose API's default 4000-row cap on bare list calls.
  const LIMIT = 100000;
  const rawSongs = await client.fetchMethod<RawSong>("songs", { limit: LIMIT });
  const rawVenues = await client.fetchMethod<RawVenue>("venues", { limit: LIMIT });
  const rawShows = (await client.fetchMethod<RawShow>("shows", { limit: LIMIT })).filter((s) => s.artist_id === GOOSE);
  const rawSetlists = (await client.fetchMethod<RawSetlistRow>("setlists", { limit: LIMIT })).filter((r) => r.artist_id === GOOSE);

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
  // Songs from the catalog, plus any referenced by setlists but missing from
  // songs.json (legacy ids like "Foxy Lady"=1) so every performance resolves.
  const songsById = new Map<number, SongRow>();
  for (const s of rawSongs) { const m = mapSong(s); songsById.set(m.songId, m); }
  for (const r of rawSetlists) {
    if (!songsById.has(r.song_id)) songsById.set(r.song_id, mapSongFromSetlist(r));
  }
  const songs = [...songsById.values()];
  const tours = [...toursById.values()];
  const shows: ShowRow[] = rawShows.map((s) => mapShow(s, notesByShow.get(s.show_id) ?? null));
  const performances = rawSetlists.map(mapPerformance);

  // FK-safe write order.
  await upsertArtists(db, [{ artistId: GOOSE, name: "Goose" }]);
  await upsertVenues(db, venues);
  await upsertTours(db, tours);
  await upsertSongs(db, songs);
  await ensureSongSlugs(db);
  await upsertShows(db, shows);
  await upsertPerformances(db, performances);

  return {
    venues: venues.length, tours: tours.length, songs: songs.length,
    shows: shows.length, performances: performances.length,
  };
}
