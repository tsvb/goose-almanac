import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/app/_components/container";
import { ShowRow } from "@/app/_components/show-card";
import { ArrowLeft, ArrowRight } from "@/app/_components/marks";
import { listShows } from "@/lib/queries/shows";
import { listYears } from "@/lib/queries/dimensions";
import { compact } from "@/lib/queries/format";
import { getExperience } from "@/lib/experience.server";
import { Doc, Breadcrumb, ShowTable } from "@/app/_components/doc";

type Params = { params: Promise<{ year: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { year } = await params;
  return { title: year };
}

export default async function YearPage({ params }: Params) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr, 10);

  if (!year || year < 2012 || year > 2030) {
    notFound();
  }

  const [{ rows, total }, years] = await Promise.all([
    listShows({ year, perPage: 400, dir: "asc" }),
    listYears(),
  ]);

  if (total === 0) notFound();

  const yearMeta = years.find((y) => y.year === year);
  const showCount = yearMeta?.shows ?? total;
  const songCount = yearMeta?.songs ?? 0;

  // Sorted desc by year (as returned by listYears), find prev/next that have shows
  const yearsWithShows = years.map((y) => y.year).sort((a, b) => a - b);
  const idx = yearsWithShows.indexOf(year);
  const prevYear = idx > 0 ? yearsWithShows[idx - 1] : null;
  const nextYear = idx < yearsWithShows.length - 1 ? yearsWithShows[idx + 1] : null;

  const experience = await getExperience();

  if (experience === "minimal") {
    return (
      <Container className="py-8">
        <Doc>
          <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { href: "/shows", label: "Shows" }, { label: String(year) }]} />
          <h1>{year}</h1>
          <p className="doc-crumb">{rows.length} {rows.length === 1 ? "show" : "shows"}</p>
          <ShowTable shows={rows} />
        </Doc>
      </Container>
    );
  }

  return (
    <>
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-line">
        <div className="stage-glow inset-x-0 top-0 h-72" />
        <Container className="relative py-14 sm:py-20">
          <span className="eyebrow rise" style={{ animationDelay: "0ms" }}>
            The year
          </span>
          <h1
            className="rise mt-4 font-display text-[5rem] leading-none tracking-tight text-ink sm:text-[7rem]"
            style={{ animationDelay: "60ms" }}
          >
            {year}
          </h1>
          <p
            className="rise mt-4 font-mono text-sm text-faint"
            style={{ animationDelay: "120ms" }}
          >
            <span className="text-ink">{compact(showCount)}</span> shows
            {" · "}
            <span className="text-ink">{compact(songCount)}</span> songs played
          </p>

          {/* Prev / Next year nav */}
          <div
            className="rise mt-8 flex items-center gap-3 font-mono text-xs"
            style={{ animationDelay: "180ms" }}
          >
            {prevYear ? (
              <Link
                href={`/years/${prevYear}`}
                className="flex items-center gap-1 rounded border border-line px-3 py-1.5 text-muted transition hover:border-gold/55 hover:text-gold"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {prevYear}
              </Link>
            ) : (
              <span className="invisible select-none px-3 py-1.5">‹ prev</span>
            )}
            {nextYear && (
              <Link
                href={`/years/${nextYear}`}
                className="flex items-center gap-1 rounded border border-line px-3 py-1.5 text-muted transition hover:border-gold/55 hover:text-gold"
              >
                {nextYear}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </Container>
      </header>

      {/* Show list */}
      <section>
        <Container className="py-12">
          <div className="surface-card divide-y divide-line-soft overflow-hidden">
            {rows.map((show) => (
              <ShowRow key={show.showId} show={show} />
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
