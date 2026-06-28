import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/app/_components/container";
import { SectionHeader } from "@/app/_components/section-header";
import { ShowRow } from "@/app/_components/show-card";
import { SearchBox } from "@/app/_components/search-box";
import { MapPin } from "@/app/_components/marks";
import { searchShows } from "@/lib/queries/shows";
import { searchVenues, searchTours } from "@/lib/queries/dimensions";
import { locationLine, formatShortDate } from "@/lib/queries/format";
import { getExperience } from "@/lib/experience.server";
import { Doc, Breadcrumb, ShowTable, EntityTable, DocSection } from "@/app/_components/doc";

type Props = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search: ${q}` : "Search",
    description: q
      ? `Goose Almanac search results for "${q}".`
      : "Search the Goose Almanac by date, venue, city, or tour.",
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const term = q?.trim() ?? "";

  if (!term) {
    return (
      <div className="relative overflow-hidden border-b border-line">
        <div className="stage-glow inset-x-0 top-0 h-72" />
        <Container className="relative py-16 sm:py-24">
          <span className="eyebrow">Search the almanac</span>
          <h1 className="mt-4 font-display text-[2.4rem] leading-[1.06] tracking-tight text-ink sm:text-5xl">
            Every show. Every night.
            <br />
            <span className="italic text-gold">Find yours.</span>
          </h1>
          <p className="mt-4 max-w-md text-muted">
            Search by date (2022-06-24), venue, city, or tour.
          </p>
          <div className="mt-8 max-w-xl">
            <SearchBox size="full" />
          </div>
        </Container>
      </div>
    );
  }

  const [shows, venues, tours] = await Promise.all([
    searchShows(term, 24),
    searchVenues(term, 12),
    searchTours(term, 8),
  ]);

  const total = shows.length + venues.length + tours.length;
  const experience = await getExperience();

  if (experience === "minimal") {
    return (
      <Container className="py-8">
        <Doc>
          <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { label: "Search" }]} />
          <h1>{term ? `Search: ${term}` : "Search"}</h1>
          {!term ? <p>Enter a query in the address bar: <code>/search?q=red+rocks</code></p> : (
            <>
              {shows.length > 0 && <DocSection title="Shows"><ShowTable shows={shows} /></DocSection>}
              {venues.length > 0 && <DocSection title="Venues"><EntityTable rows={venues.map((v) => ({ href: `/venues/${v.venueId}`, name: v.name, sub: locationLine(v.city, v.state, v.country), count: v.shows }))} /></DocSection>}
              {tours.length > 0 && <DocSection title="Tours"><EntityTable rows={tours.map((t) => ({ href: `/tours/${t.tourId}`, name: t.name, count: t.shows }))} /></DocSection>}
              {shows.length === 0 && venues.length === 0 && tours.length === 0 && <p>No results for &ldquo;{term}&rdquo;.</p>}
            </>
          )}
        </Doc>
      </Container>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="relative overflow-hidden border-b border-line">
        <div className="stage-glow inset-x-0 top-0 h-72" />
        <Container className="relative py-12 sm:py-16">
          <span className="eyebrow">Search the almanac</span>
          <h1 className="mt-3 font-display text-[2rem] leading-tight tracking-tight text-ink sm:text-4xl">
            Results for{" "}
            <span className="italic text-gold">&ldquo;{term}&rdquo;</span>
          </h1>
          <div className="mt-6 max-w-xl">
            <SearchBox size="full" />
          </div>
        </Container>
      </div>

      <Container className="py-12">
        {/* Empty state */}
        {total === 0 && (
          <div className="py-16 text-center">
            <p className="font-display text-2xl text-ink">
              No results for &ldquo;{term}&rdquo;
            </p>
            <p className="mt-3 text-muted">
              Try a date like{" "}
              <span className="font-mono text-gold-soft">2022-06-24</span>, a
              venue name, or a city.
            </p>
          </div>
        )}

        {/* Shows */}
        {shows.length > 0 && (
          <section className="mb-12">
            <SectionHeader eyebrow="Matching nights" title="Shows" />
            <div className="surface-card divide-y divide-line-soft">
              {shows.map((show) => (
                <ShowRow key={show.showId} show={show} />
              ))}
            </div>
          </section>
        )}

        {/* Venues */}
        {venues.length > 0 && (
          <section className="mb-12">
            <SectionHeader eyebrow="Places" title="Venues" />
            <ul className="surface-card divide-y divide-line-soft">
              {venues.map((v) => {
                const loc = locationLine(v.city, v.state, v.country);
                return (
                  <li key={v.venueId}>
                    <Link
                      href={`/venues/${v.venueId}`}
                      className="group flex items-center gap-4 px-4 py-4 transition hover:bg-surface-2"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-faint transition group-hover:border-gold group-hover:text-gold">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-base text-ink transition group-hover:text-gold">
                          {v.name}
                        </div>
                        {loc && (
                          <div className="truncate text-sm text-muted">{loc}</div>
                        )}
                      </div>
                      <span className="font-mono text-[0.7rem] text-faint">
                        {v.shows} {v.shows === 1 ? "show" : "shows"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Tours */}
        {tours.length > 0 && (
          <section className="mb-12">
            <SectionHeader eyebrow="Runs & eras" title="Tours" />
            <ul className="surface-card divide-y divide-line-soft">
              {tours.map((t) => {
                const dateRange =
                  t.start && t.end
                    ? `${formatShortDate(t.start)} – ${formatShortDate(t.end)}`
                    : t.start
                    ? `From ${formatShortDate(t.start)}`
                    : null;
                return (
                  <li key={t.tourId}>
                    <Link
                      href={`/tours/${t.tourId}`}
                      className="group flex items-center gap-4 px-4 py-4 transition hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-base text-ink transition group-hover:text-gold">
                          {t.name}
                        </div>
                        {dateRange && (
                          <div className="font-mono text-[0.7rem] text-faint">
                            {dateRange}
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-[0.7rem] text-faint">
                        {t.shows} {t.shows === 1 ? "show" : "shows"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </Container>
    </>
  );
}
