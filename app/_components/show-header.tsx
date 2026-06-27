import Link from "next/link";
import { Container } from "./container";
import { MapPin } from "./marks";
import { dateParts, locationLine, formatDuration, trackSeconds } from "@/lib/queries/format";
import type { ShowDetail, SetlistEntry } from "@/lib/queries/shows";
import type { Experience } from "@/lib/experience";

function computeStats(date: string, setlist: SetlistEntry[]) {
  const dp = dateParts(date);
  const setNumbers = new Set(
    setlist.map((e) => (e.setNumber ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const encores = [...setNumbers].filter((s) => s.startsWith("e")).length;
  const setCount = Math.max(setNumbers.size - encores, setNumbers.size === 0 ? 0 : 1);
  const totalSecs = setlist.reduce((acc, e) => acc + (trackSeconds(e.trackTime) ?? 0), 0);
  const known = setlist.filter((e) => trackSeconds(e.trackTime) != null).length;
  return { dp, encores, setCount, totalSecs, known };
}

export function ShowHeader({
  show, date, setlist, experience,
}: { show: ShowDetail; date: string; setlist: SetlistEntry[]; experience: Experience }) {
  const { dp, encores, setCount, totalSecs, known } = computeStats(date, setlist);
  const loc = locationLine(show.city, show.state, show.country);
  const durationLogged = known >= setlist.length / 2 && totalSecs > 0 ? formatDuration(totalSecs) : null;

  if (experience === "minimal") {
    return (
      <Container size="prose" className="pt-8">
        <nav className="mb-5 text-sm text-muted">
          <Link href="/">Goose Almanac</Link> / <Link href="/shows">Shows</Link> / {date}
        </nav>
        <h1 className="text-2xl font-medium text-ink">
          {dp.month} {dp.day}, {dp.year} — {show.venue ?? "Unknown venue"}
        </h1>
        <dl className="mt-3 text-[0.95rem] leading-7 text-ink">
          {loc && <div><span className="text-muted">Location:</span> {loc}</div>}
          {show.tour && <div><span className="text-muted">Tour:</span> {show.tour}</div>}
          <div>
            <span className="text-muted">Songs:</span> {setlist.length} · {setCount} {setCount === 1 ? "set" : "sets"}
            {encores > 0 ? ` + ${encores} encore${encores === 1 ? "" : "s"}` : ""}
            {durationLogged ? ` · ${durationLogged}` : ""}
          </div>
          {show.permalink && (
            <div>
              <span className="text-muted">Source:</span>{" "}
              <a href={`https://elgoose.net/setlists/${show.permalink}`} target="_blank" rel="noreferrer">elgoose.net</a>
            </div>
          )}
        </dl>
      </Container>
    );
  }

  if (experience === "functional") {
    return (
      <div className="border-b border-line">
        <Container className="py-5">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3">
            <div>
              <div className="font-mono text-sm font-medium text-ink">
                {date} · {show.venueId ? <Link href={`/venues/${show.venueId}`} className="text-gold hover:underline">{show.venue}</Link> : (show.venue ?? "Unknown venue")}
              </div>
              <div className="font-mono text-xs text-muted">
                {loc || "—"}{show.tour ? ` · ${show.tour}` : ""}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5 font-mono text-[0.7rem] text-faint">
              <span className="rounded border border-line px-2 py-0.5">{setlist.length} songs</span>
              <span className="rounded border border-line px-2 py-0.5">{setCount} {setCount === 1 ? "set" : "sets"}</span>
              {encores > 0 && <span className="rounded border border-line px-2 py-0.5">{encores} enc</span>}
              {durationLogged && <span className="rounded border border-line px-2 py-0.5">{durationLogged}</span>}
            </div>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <header className="relative overflow-hidden border-b border-line">
      <div className="stage-glow inset-x-0 top-0 h-72" />
      <Container className="relative py-12 sm:py-16">
        <span className="eyebrow">
          {show.tourId && show.tour ? (
            <Link href={`/tours/${show.tourId}`} className="transition hover:text-gold">{show.tour}</Link>
          ) : ("Goose")}
          {"  ·  "}
          {dp.weekday}
        </span>
        <h1 className="rise mt-3 font-display text-[2.6rem] leading-none tracking-tight text-ink sm:text-5xl">
          {dp.month} {dp.day}, {dp.year}
        </h1>
        <p className="mt-4 flex flex-wrap items-baseline gap-x-2 text-xl">
          <span className="text-muted">at</span>
          {show.venueId ? (
            <Link href={`/venues/${show.venueId}`} className="font-display text-2xl text-gold underline decoration-gold/30 underline-offset-4 transition hover:decoration-gold">{show.venue}</Link>
          ) : (
            <span className="font-display text-2xl text-ink">{show.venue ?? "Unknown venue"}</span>
          )}
        </p>
        {loc && (
          <span className="mt-2 flex items-center gap-1.5 text-muted">
            <MapPin className="h-4 w-4 text-faint" /> {loc}
          </span>
        )}
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-faint">
          <span><span className="text-ink">{setlist.length}</span> songs</span>
          <span className="text-line">·</span>
          <span><span className="text-ink">{setCount}</span> {setCount === 1 ? "set" : "sets"}</span>
          {encores > 0 && (<><span className="text-line">·</span><span><span className="text-ink">{encores}</span> {encores === 1 ? "encore" : "encores"}</span></>)}
          {durationLogged && (<><span className="text-line">·</span><span><span className="text-ink">{durationLogged}</span> logged</span></>)}
          {show.permalink && (<><span className="text-line">·</span><a href={`https://elgoose.net/setlists/${show.permalink}`} target="_blank" rel="noreferrer" className="text-sage transition hover:text-ink">View on elgoose ↗</a></>)}
        </div>
      </Container>
    </header>
  );
}
