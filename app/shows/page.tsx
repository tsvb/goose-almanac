import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/app/_components/container";
import { ShowList } from "@/app/_components/show-list";
import { ArrowLeft, ArrowRight } from "@/app/_components/marks";
import { listShows } from "@/lib/queries/shows";
import { listYears } from "@/lib/queries/dimensions";
import { compact } from "@/lib/queries/format";
import { getExperience } from "@/lib/experience.server";
import { Doc, Breadcrumb, ShowTable } from "@/app/_components/doc";

type SearchParams = Promise<{ year?: string; dir?: string; page?: string }>;

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

const PER_PAGE = 30;

export default async function ShowsBrowsePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const year = sp.year ? parseInt(sp.year, 10) : undefined;
  const dir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, sp.page ? parseInt(sp.page, 10) : 1);

  const [{ rows, total }, years] = await Promise.all([
    listShows({ year, dir, page, perPage: PER_PAGE }),
    listYears(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const experience = await getExperience();

  // Build query-string helpers
  function buildHref(overrides: { year?: number | null; dir?: string; page?: number }) {
    const params = new URLSearchParams();
    const nextYear = "year" in overrides ? overrides.year : year;
    const nextDir = overrides.dir ?? dir;
    const nextPage = overrides.page ?? 1;
    if (nextYear != null) params.set("year", String(nextYear));
    if (nextDir !== "desc") params.set("dir", nextDir);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return `/shows${qs ? `?${qs}` : ""}`;
  }

  const flipDir = dir === "desc" ? "asc" : "desc";
  const dirLabel = dir === "desc" ? "Newest → Oldest" : "Oldest → Newest";
  const flipDirLabel = dir === "desc" ? "Show oldest first" : "Show newest first";

  const countLine = year
    ? `${compact(total)} ${total === 1 ? "show" : "shows"} in ${year}`
    : `${compact(total)} ${total === 1 ? "show" : "shows"} · ${dir === "desc" ? "newest first" : "oldest first"}`;

  if (experience === "minimal") {
    return (
      <Container className="py-8">
        <Doc>
          <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { label: "Shows" }]} />
          <h1>{year ? `Shows in ${year}` : "All shows"}</h1>
          <p className="doc-crumb">{countLine}</p>
          <p className="doc-crumb">
            Years: <Link href={buildHref({ year: null })}>All</Link>
            {years.map((y) => (<span key={y.year}> · <Link href={buildHref({ year: y.year })}>{y.year}</Link></span>))}
          </p>
          <ShowTable shows={rows} />
          {totalPages > 1 && (
            <p className="doc-crumb">
              {page > 1 ? <Link href={buildHref({ page: page - 1 })}>← Previous</Link> : null}
              {" "}Page {page} of {totalPages}{" "}
              {page < totalPages ? <Link href={buildHref({ page: page + 1 })}>Next →</Link> : null}
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
            The Goose Almanac · Shows
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
        {/* Filters row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Year pills */}
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={buildHref({ year: null })}
              className={[
                "rounded-full border px-3 py-1 font-mono text-xs transition",
                !year
                  ? "border-gold text-gold"
                  : "border-line text-muted hover:border-line-soft hover:text-ink",
              ].join(" ")}
            >
              All
            </Link>
            {years.map((y) => (
              <Link
                key={y.year}
                href={buildHref({ year: y.year })}
                className={[
                  "rounded-full border px-3 py-1 font-mono text-xs transition",
                  year === y.year
                    ? "border-gold text-gold"
                    : "border-line text-muted hover:border-line-soft hover:text-ink",
                ].join(" ")}
              >
                {y.year}
              </Link>
            ))}
          </div>

          {/* Sort toggle */}
          <Link
            href={buildHref({ dir: flipDir, page: 1 })}
            className="shrink-0 rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition hover:border-gold hover:text-gold"
            title={flipDirLabel}
          >
            {dirLabel}
          </Link>
        </div>

        {/* Show list */}
        <div className="mt-8">
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
                  href={buildHref({ page: page - 1 })}
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
                  href={buildHref({ page: page + 1 })}
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
