import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/app/_components/container";
import { Setlist } from "@/app/_components/setlist";
import { ArrowLeft, ArrowRight } from "@/app/_components/marks";
import { ShowHeader } from "@/app/_components/show-header";
import { getShowDetails, getSetlist, getShowNeighbors } from "@/lib/queries/shows";
import { getExperience } from "@/lib/experience.server";
import { JsonLd } from "@/app/_components/json-ld";
import { showJsonLd } from "@/lib/jsonld";
import {
  dateParts,
  formatLongDate,
  formatShortDate,
  locationLine,
  showHref,
} from "@/lib/queries/format";

type Params = { params: Promise<{ date: string }>; searchParams: Promise<{ n?: string }> };

function isValidShowDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [, m, day] = d.split("-").map(Number);
  return m >= 1 && m <= 12 && day >= 1 && day <= 31;
}

async function resolveShow(date: string, n?: string) {
  if (!isValidShowDate(date)) return null;
  const details = await getShowDetails(date);
  if (details.length === 0) return null;
  const order = n ? parseInt(n, 10) : null;
  return (order && details.find((d) => d.order === order)) || details[0];
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { date } = await params;
  const { n } = await searchParams;
  const show = await resolveShow(date, n);
  if (!show) return { title: "Show not found" };
  const where = show.venue ? `${show.venue}, ${locationLine(show.city, show.state, show.country)}` : "";
  return {
    title: `${formatShortDate(date)} · ${show.venue ?? "Goose"}`,
    description: `Goose setlist for ${formatLongDate(date)}${where ? ` at ${where}` : ""}.`,
  };
}

export default async function ShowPage({ params, searchParams }: Params) {
  const { date } = await params;
  const { n } = await searchParams;
  if (!isValidShowDate(date)) notFound();
  const details = await getShowDetails(date);
  if (details.length === 0) notFound();
  const order = n ? parseInt(n, 10) : null;
  const show = (order && details.find((d) => d.order === order)) || details[0];

  const [setlist, neighbors] = await Promise.all([
    getSetlist(show.showId),
    getShowNeighbors(date, show.order),
  ]);

  const experience = await getExperience();
  const ld = showJsonLd(show, setlist);

  const dp = dateParts(date);
  const loc = locationLine(show.city, show.state, show.country);
  const siblings = details.filter((d) => d.showId !== show.showId);

  return (
    <article>
      <JsonLd data={ld} />
      {/* Top bar */}
      {experience !== "minimal" && (
        <div className="border-b border-line">
          <Container className="flex items-center justify-between gap-4 py-3.5">
            <Link href="/shows" className="group flex items-center gap-1.5 font-mono text-xs text-muted transition hover:text-ink">
              <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
              All shows
            </Link>
            <div className="flex items-center gap-1 font-mono text-xs">
              {neighbors.prev && (
                <Link href={showHref(neighbors.prev.date)} className="rounded px-2 py-1 text-muted transition hover:bg-surface hover:text-ink" title={neighbors.prev.venue ?? ""}>
                  ‹ {formatShortDate(neighbors.prev.date)}
                </Link>
              )}
              {neighbors.next && (
                <Link href={showHref(neighbors.next.date)} className="rounded px-2 py-1 text-muted transition hover:bg-surface hover:text-ink" title={neighbors.next.venue ?? ""}>
                  {formatShortDate(neighbors.next.date)} ›
                </Link>
              )}
            </div>
          </Container>
        </div>
      )}

      <ShowHeader show={show} date={date} setlist={setlist} experience={experience} />

      {/* Also this day */}
      {siblings.length > 0 && (
        <div className="border-b border-line">
          <Container className="py-4">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-faint">
              Also this day:
              {siblings.map((s) => (
                <Link key={s.showId} href={showHref(s.date, s.order)} className="rounded border border-line px-2 py-0.5 text-muted transition hover:border-gold hover:text-gold">
                  Show {s.order}
                </Link>
              ))}
            </div>
          </Container>
        </div>
      )}

      {/* Body */}
      <Container size="prose" className="py-12">
        {show.notes && (
          <aside className="mb-10 rounded-lg border-l-2 border-gold bg-surface/60 px-5 py-4">
            <span className="eyebrow">From the notes</span>
            <p className="mt-2 leading-relaxed text-ink">{show.notes}</p>
          </aside>
        )}

        <Setlist entries={setlist} experience={experience} />
        {experience === "minimal" && (
          <details className="mt-10 border-t border-line pt-4 text-sm">
            <summary className="cursor-pointer text-muted">Structured data (schema.org MusicEvent)</summary>
            <pre className="mt-3 overflow-auto rounded border border-line bg-surface p-3 font-mono text-xs text-muted">
              {JSON.stringify(ld, null, 2)}
            </pre>
          </details>
        )}
      </Container>

      {/* Prev / next */}
      <nav className="border-t border-line">
        <Container className="grid gap-3 py-8 sm:grid-cols-2">
          {neighbors.prev ? (
            <Link href={showHref(neighbors.prev.date)} className="group flex flex-col rounded-lg border border-line bg-surface p-5 transition hover:border-gold/55 hover:bg-surface-2">
              <span className="flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-wider text-faint">
                <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" /> Previous night
              </span>
              <span className="mt-2 font-display text-lg text-ink group-hover:text-gold">{formatShortDate(neighbors.prev.date)}</span>
              <span className="text-sm text-muted">{neighbors.prev.venue}</span>
            </Link>
          ) : (
            <div />
          )}
          {neighbors.next && (
            <Link href={showHref(neighbors.next.date)} className="group flex flex-col items-end rounded-lg border border-line bg-surface p-5 text-right transition hover:border-gold/55 hover:bg-surface-2">
              <span className="flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-wider text-faint">
                Next night <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
              <span className="mt-2 font-display text-lg text-ink group-hover:text-gold">{formatShortDate(neighbors.next.date)}</span>
              <span className="text-sm text-muted">{neighbors.next.venue}</span>
            </Link>
          )}
        </Container>
      </nav>
    </article>
  );
}
