export const NUGS_SCHEME = "applenugs";
const ARTIST = "Goose";

export type NugsMedia = "audio" | "video";

/** Build a query string with `%20` encoding (NOT URLSearchParams, which emits `+`
 *  — Swift's URLComponents does not decode `+` to a space). Fixed key order;
 *  empty/nullish values are dropped. */
function query(pairs: Array<[string, string | number | null | undefined]>): string {
  return pairs
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export function nugsShowHref(o: { date: string; venue?: string | null; media?: NugsMedia }): string {
  const q = query([
    ["artist", ARTIST],
    ["venue", o.venue],
    ["media", o.media === "video" ? "video" : undefined],
  ]);
  return `${NUGS_SCHEME}://show/${o.date}?${q}`;
}

export function nugsTrackHref(o: {
  date: string; venue?: string | null; song: string;
  set?: string | null; pos?: number | null; media?: NugsMedia;
}): string {
  const q = query([
    ["artist", ARTIST],
    ["song", o.song],
    ["set", o.set],
    ["pos", o.pos],
    ["venue", o.venue],
    ["media", o.media === "video" ? "video" : undefined],
  ]);
  return `${NUGS_SCHEME}://show/${o.date}?${q}`;
}

/** Web fallback for users without the app: a reliable nugs.net web landing.
 *  Kept generic on purpose — `play.nugs.net` is a SPA and its date/artist search
 *  route isn't confirmed; a precise date-search URL can replace this body later
 *  without touching callers (the signature already carries date/venue). */
export function nugsWebFallback(_o: { date: string; venue?: string | null }): string {
  return "https://play.nugs.net/";
}
