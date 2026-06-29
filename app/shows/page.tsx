import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/app/_components/container";
import { ShowList } from "@/app/_components/show-list";
import { ArrowLeft, ArrowRight } from "@/app/_components/marks";
import { listShows, findLatestPastShow } from "@/lib/queries/shows";
import { listYears, listTours } from "@/lib/queries/dimensions";
import { compact } from "@/lib/queries/format";
import { getExperience } from "@/lib/experience.server";
import { Doc, Breadcrumb, ShowTable } from "@/app/_components/doc";
import {
  buildShowsHref,
  resolveDir,
  resolvePer,
  SHOWS_PER_OPTIONS,
  type ShowsQuery,
} from "@/lib/shows-url";

type SearchParams = Promise<{ year?: string; tour?: string; dir?: string; per?: string; page?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const sp = await searchParams;
  const year = sp.year ? parseInt(sp.year, 10) : undefined;
  return {
    title: year ? `Shows in ${year}` : "Shows",
  };
}

const pillClass = (active: boolean) =>
  [
    "rounded-full border px-3 py-1 font-mono text-xs transition",
    active
      ? "border-gold text-gold"
      : "border-line text-muted hover:border-line-soft hover:text-ink",
  ].join(" ");

export default async function ShowsBrowsePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const year = sp.year ? parseInt(sp.year, 10) : undefined;
  const tourId = sp.tour ? parseInt(sp.tour, 10) : undefined;
  const dir = resolveDir(sp.dir);
  const per = resolvePer(sp.per);
  const page = Math.max(1, sp.page ? parseInt(sp.page, 10) : 1);

  const current: ShowsQuery = { year, tourId, dir, per, page };
  const href = (overrides: Parameters<typeof buildShowsHref>[1]) => buildShowsHref(current, overrides);

  const [{ rows, total }, years, allTours, latest] = await Promise.all([
    listShows({ year, tourId, dir, page, perPage: per }),
    listYears(),
    listTours(),
    findLatestPastShow({ year, tourId, dir, perPage: per }),
  ]);

  const tourOptions = year ? allTours.filter((t) => t.year === year) : [];
  const selectedTour = tourId ? allTours.find((t) => t.tourId === tourId) : undefined;
  const totalPages = Math.max(1, Math.ceil(total / per));
  const experience = await getExperience();

  const flipDir = dir === "asc" ? "desc" : "asc";
  const dirLabel = dir === "asc" ? "Oldest → Newest" : "Newest → Oldest";
  const flipDirLabel = dir === "asc" ? "Show newest first" : "Show oldest first";

  const scope = selectedTour ? selectedTour.name : year ? `in ${year}` : null;
  const countLine = scope
    ? `${compact(total)} ${total === 1 ? "show" : "shows"} · ${scope}`
    : `${compact(total)} ${total === 1 ? "show" : "shows"} · ${dir === "asc" ? "oldest first" : "newest first"}`;

  const jumpLabel = latest?.isToday ? "Tonight’s show" : "Most recent show";
  const jumpHref = latest ? `${href({ page: latest.page })}#show-${latest.showId}` : null;

  if (experience === "minimal") {
    return (
      <Container className="py-8">
        <Doc>
          <Breadcrumb trail={[{ href: "/", label: "Goose Index" }, { label: "Shows" }]} />
          <h1>{selectedTour ? selectedTour.name : year ? `Shows in ${year}` : "All shows"}</h1>
          <p className="doc-crumb">{countLine}</p>
          <p className="doc-crumb">
            Years: <Link href={href({ year: null })}>All</Link>
            {years.map((y) => (<span key={y.year}> · <Link href={href({ year: y.year })}>{y.year}</Link></span>))}
          </p>
          {tourOptions.length > 0 && (
            <p className="doc-crumb">
              Tours: <Link href={href({ tourId: null })}>All {year}</Link>
              {tourOptions.map((t) => (<span key={t.tourId}> · <Link href={href({ tourId: t.tourId })}>{t.name}</Link></span>))}
            </p>
          )}
          <p className="doc-crumb">
            Per page: {SHOWS_PER_OPTIONS.map((n, i) => (
              <span key={n}>{i > 0 ? " · " : ""}<Link href={href({ per: n })}>{n}</Link></span>
            ))}
            {" · "}Sort: <Link href={href({ dir: flipDir })}>{dirLabel}</Link>
            {jumpHref ? <> {" · "}<Link href={jumpHref}>{jumpLabel}</Link></> : null}
          </p>
          <ShowTable shows={rows} />
          {totalPages > 1 && (
            <p className="doc-crumb">
              {page > 1 ? <Link href={href({ page: page - 1 })}>← Previous</Link> : null}
              {" "}Page {page} of {totalPages}{" "}
              {page < totalPages ? <Link href={href({ page: page + 1 })}>Next →</Link> : null}
            </p>
          )}
        </Doc>
      </Container>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="relative overflow-hidden border-b border-line">
        <div className="stage-glow inset-x-0 top-0 h-72" />
        <Container className="relative py-12 sm:py-16">
          <span className="eyebrow rise" style={{ animationDelay: "0ms" }}>
            Goose Index · Shows
          </span>
          <h1
            className="rise mt-3 font-display text-[2.6rem] leading-none tracking-tight text-ink sm:text-5xl"
            style={{ animationDelay: "60ms" }}
          >
            Every show
          </h1>
          <p
            className="rise mt-3 font-mono text-sm text-faint"
            style={{ animationDelay: "120ms" }}
          >
            {countLine}
          </p>
        </Container>
      </header>

      <Container className="py-10">
        {/* Year filter + sort */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap gap-1.5">
            <Link href={href({ year: null })} className={pillClass(!year)}>All</Link>
            {years.map((y) => (
              <Link key={y.year} href={href({ year: y.year })} className={pillClass(year === y.year)}>
                {y.year}
              </Link>
            ))}
          </div>

          <Link
            href={href({ dir: flipDir })}
            className="shrink-0 rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition hover:border-gold hover:text-gold"
            title={flipDirLabel}
          >
            {dirLabel}
          </Link>
        </div>

        {/* Contextual tour filter — appears once a year is chosen */}
        {tourOptions.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[0.62rem] uppercase tracking-wider text-faint">Tours</span>
            <Link href={href({ tourId: null })} className={pillClass(!tourId)}>All {year}</Link>
            {tourOptions.map((t) => (
              <Link key={t.tourId} href={href({ tourId: t.tourId })} className={pillClass(tourId === t.tourId)}>
                {t.name}
              </Link>
            ))}
          </div>
        )}

        {/* Per-page + jump-to-recent toolbar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
          <div className="flex items-center gap-1.5">
            <span className="mr-1 font-mono text-[0.62rem] uppercase tracking-wider text-faint">Per page</span>
            {SHOWS_PER_OPTIONS.map((n) => (
              <Link key={n} href={href({ per: n })} className={pillClass(per === n)}>{n}</Link>
            ))}
          </div>
          {jumpHref && (
            <Link
              href={jumpHref}
              className="shrink-0 rounded border border-gold/40 px-3 py-1.5 font-mono text-xs text-gold transition hover:border-gold hover:bg-gold/10"
            >
              {jumpLabel} →
            </Link>
          )}
        </div>

        {/* Show list */}
        <div className="mt-6">
          {rows.length === 0 ? (
            <div className="surface-card py-16 text-center">
              <p className="font-display text-xl text-muted">No shows found.</p>
              <Link href="/shows" className="mt-4 inline-block font-mono text-sm text-sage hover:text-ink">
                Clear filters
              </Link>
            </div>
          ) : (
            <ShowList rows={rows} experience={experience} />
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between gap-4">
            <div>
              {page > 1 ? (
                <Link
                  href={href({ page: page - 1 })}
                  className="group flex items-center gap-1.5 rounded border border-line px-4 py-2 font-mono text-sm text-muted transition hover:border-gold hover:text-gold"
                >
                  <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
                  Previous
                </Link>
              ) : (
                <span className="flex items-center gap-1.5 rounded border border-line px-4 py-2 font-mono text-sm text-faint opacity-40 select-none">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Previous
                </span>
              )}
            </div>

            <span className="font-mono text-xs text-faint">
              Page {compact(page)} of {compact(totalPages)}
            </span>

            <div>
              {page < totalPages ? (
                <Link
                  href={href({ page: page + 1 })}
                  className="group flex items-center gap-1.5 rounded border border-line px-4 py-2 font-mono text-sm text-muted transition hover:border-gold hover:text-gold"
                >
                  Next
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </Link>
              ) : (
                <span className="flex items-center gap-1.5 rounded border border-line px-4 py-2 font-mono text-sm text-faint opacity-40 select-none">
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          </div>
        )}
      </Container>
    </>
  );
}
