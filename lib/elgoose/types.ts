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
  venuename: string;
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
