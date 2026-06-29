export type Dir = "asc" | "desc";

export const SHOWS_DEFAULT_DIR: Dir = "asc";
export const SHOWS_DEFAULT_PER = 50;
export const SHOWS_PER_OPTIONS = [50, 100] as const;

/** The resolved, canonical state of the /shows view. */
export type ShowsQuery = {
  year?: number;
  tourId?: number;
  dir: Dir;
  per: number;
  page: number;
};

export function resolveDir(value: string | null | undefined): Dir {
  return value === "desc" ? "desc" : SHOWS_DEFAULT_DIR;
}

export function resolvePer(value: string | null | undefined): number {
  const n = value ? parseInt(value, 10) : NaN;
  return (SHOWS_PER_OPTIONS as readonly number[]).includes(n) ? n : SHOWS_DEFAULT_PER;
}

type Overrides = {
  year?: number | null;
  tourId?: number | null;
  dir?: Dir;
  per?: number;
  page?: number;
};

/**
 * Build a /shows URL from the current view plus overrides. Defaults are omitted
 * so the bare page is clean. Changing the year clears any tour selection (tours
 * belong to a year), and any filter change that isn't an explicit page move
 * resets back to page 1.
 */
export function buildShowsHref(current: ShowsQuery, overrides: Overrides = {}): string {
  const changingYear = "year" in overrides;
  const nextYear = changingYear ? overrides.year ?? null : current.year ?? null;
  const nextTour =
    "tourId" in overrides
      ? overrides.tourId ?? null
      : changingYear
        ? null
        : current.tourId ?? null;
  const nextDir = overrides.dir ?? current.dir;
  const nextPer = overrides.per ?? current.per;
  const nextPage = overrides.page ?? 1;

  const params = new URLSearchParams();
  if (nextYear != null) params.set("year", String(nextYear));
  if (nextTour != null) params.set("tour", String(nextTour));
  if (nextDir !== SHOWS_DEFAULT_DIR) params.set("dir", nextDir);
  if (nextPer !== SHOWS_DEFAULT_PER) params.set("per", String(nextPer));
  if (nextPage > 1) params.set("page", String(nextPage));

  const qs = params.toString();
  return `/shows${qs ? `?${qs}` : ""}`;
}
