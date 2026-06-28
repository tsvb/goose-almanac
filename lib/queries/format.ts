// Date helpers for elgoose "YYYY-MM-DD" strings. Parsed in UTC to stay
// timezone-stable (the date is the calendar date of the show, no time component).

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function ymd(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

export function yearOf(date: string): number {
  return ymd(date).y;
}

export function weekdayOf(date: string): string {
  const { y, m, d } = ymd(date);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "Friday, June 24, 2022" */
export function formatLongDate(date: string): string {
  const { y, m, d } = ymd(date);
  return `${weekdayOf(date)}, ${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "Jun 24, 2022" */
export function formatShortDate(date: string): string {
  const { y, m, d } = ymd(date);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
}

/** "June 24" — for "On This Day". */
export function formatMonthDay(date: string): string {
  const { m, d } = ymd(date);
  return `${MONTHS[m - 1]} ${d}`;
}

/** Big stacked date parts for show headers. */
export function dateParts(date: string): { weekday: string; month: string; day: number; year: number } {
  const { y, m, d } = ymd(date);
  return { weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()], month: MONTHS[m - 1], day: d, year: y };
}

export function locationLine(city: string | null, state: string | null, country: string | null): string {
  const parts = [city, state, country && country !== "USA" ? country : null].filter(Boolean);
  return parts.join(", ");
}

/** Compact integer with thousands separators. */
export function compact(n: number): string {
  return n.toLocaleString("en-US");
}

/** Canonical URL for a show. Multi-show days disambiguate with ?n=order. */
export function showHref(date: string, order?: number | null): string {
  return order && order > 1 ? `/shows/${date}?n=${order}` : `/shows/${date}`;
}

/** Parse "m:ss" / "h:mm:ss" track time into seconds, or null. */
export function trackSeconds(t: string | null): number | null {
  if (!t) return null;
  const parts = t.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Seconds → "72:14" style or "1h 12m" for long durations. */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const RETURN_LABEL = "Dusted Off";

export function slugifySongName(name: string): string {
  return name
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function songHref(s: { slug: string | null; songId?: number }): string {
  return `/songs/${s.slug ?? (s.songId != null ? slugifySongName(String(s.songId)) : "")}`;
}
