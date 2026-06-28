import Link from "next/link";
import { Container } from "./_components/container";
import { ShowCard } from "./_components/show-card";
import { SearchBox } from "./_components/search-box";
import { SectionHeader } from "./_components/section-header";
import { ArrowRight, Calendar, MapPin, Disc } from "./_components/marks";
import { getOverviewStats } from "@/lib/queries/stats";
import { getRecentShows, getUpcomingShows, getOnThisDay } from "@/lib/queries/shows";
import { compact, yearOf, formatMonthDay, formatLongDate, dateParts, locationLine, showHref } from "@/lib/queries/format";
import { getExperience } from "@/lib/experience.server";
import { Doc, MetaTable, ShowTable, DocSection } from "./_components/doc";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-display text-[2rem] leading-none text-ink sm:text-4xl">{value}</span>
      <span className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-faint">{label}</span>
    </div>
  );
}

export default async function Home() {
  const [stats, recent, upcoming, onThisDay] = await Promise.all([
    getOverviewStats(),
    getRecentShows(6),
    getUpcomingShows(4),
    getOnThisDay(),
  ]);
  const experience = await getExperience();

  if (experience === "minimal") {
    return (
      <Container className="py-8">
        <Doc>
          <h1>Goose Almanac</h1>
          <p>An almanac of every Goose show — setlists, segues, jams, venues, and tours. Setlist data from <a href="https://elgoose.net" target="_blank" rel="noreferrer">elgoose.net</a>.</p>
          <MetaTable rows={[
            { k: "Shows", v: compact(stats.showsPlayed) },
            { k: "Songs", v: compact(stats.songs) },
            { k: "Venues", v: compact(stats.venues) },
            { k: "Performances", v: compact(stats.performances) },
            ...(stats.firstDate ? [{ k: "First show", v: stats.firstDate }] : []),
            ...(stats.lastPlayedDate ? [{ k: "Last show", v: stats.lastPlayedDate }] : []),
          ]} />
          {onThisDay.length > 0 && <DocSection title="On this day"><ShowTable shows={onThisDay.slice(0, 6)} /></DocSection>}
          <DocSection title="Recent shows"><ShowTable shows={recent} /></DocSection>
          {upcoming.length > 0 && <DocSection title="Upcoming"><ShowTable shows={upcoming} /></DocSection>}
          <DocSection title="Browse">
            <p><Link href="/shows">All shows</Link> · <Link href="/venues">Venues</Link> · <Link href="/tours">Tours</Link> · <Link href="/on-this-day">On this day</Link></p>
          </DocSection>
        </Doc>
      </Container>
    );
  }

  const sinceYear = stats.firstDate ? yearOf(stats.firstDate) : 2014;
  const todayLabel = onThisDay.length ? formatMonthDay(onThisDay[0].date) : "";

  return (
    <>
      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="stage-glow inset-x-0 top-0 h-[420px]" />
        <Container className="relative pt-16 pb-14 sm:pt-24 sm:pb-20">
          <span className="eyebrow rise" style={{ animationDelay: "0ms" }}>
            The Goose Almanac · est. {sinceYear}
          </span>
          <h1
            className="rise mt-5 max-w-3xl font-display text-[2.7rem] leading-[1.04] tracking-tight text-ink sm:text-6xl"
            style={{ animationDelay: "60ms" }}
          >
            An almanac of every <span className="italic text-gold">Goose</span> show.
          </h1>
          <p
            className="rise mt-5 max-w-xl text-lg leading-relaxed text-muted"
            style={{ animationDelay: "120ms" }}
          >
            {compact(stats.showsPlayed)} shows since {sinceYear} — full setlists with segues and
            jams, every venue, every tour, and the story of each night.
          </p>
          <div className="rise mt-8 max-w-xl" style={{ animationDelay: "180ms" }}>
            <SearchBox size="full" />
          </div>

          <div
            className="rise mt-12 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4"
            style={{ animationDelay: "260ms" }}
          >
            <Stat value={compact(stats.showsPlayed)} label="Shows" />
            <Stat value={compact(stats.performances)} label="Songs played" />
            <Stat value={compact(stats.songs)} label="Unique songs" />
            <Stat value={compact(stats.venues)} label="Venues" />
          </div>
        </Container>
      </section>

      {/* ---- On this day ---- */}
      {onThisDay.length > 0 && (
        <section className="border-b border-line bg-surface/40">
          <Container className="py-12">
            <div className="flex items-center gap-2 text-gold">
              <Calendar className="h-4 w-4" />
              <span className="eyebrow">On this day · {todayLabel}</span>
            </div>
            <p className="mt-3 max-w-2xl text-muted">
              {onThisDay.length === 1
                ? "Goose played one show on this date:"
                : `Goose has played ${onThisDay.length} shows on this date over the years:`}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {onThisDay.slice(0, 3).map((s) => (
                <ShowCard key={`${s.showId}`} show={s} />
              ))}
            </div>
            {onThisDay.length > 3 && (
              <Link href="/on-this-day" className="mt-5 inline-flex items-center gap-1.5 font-mono text-xs text-sage hover:text-ink">
                All {onThisDay.length} shows on {todayLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </Container>
        </section>
      )}

      {/* ---- Latest shows ---- */}
      <section>
        <Container className="py-16">
          <SectionHeader eyebrow="Freshly logged" title="Latest shows" href="/shows" linkLabel="Browse all shows" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((s) => (
              <ShowCard key={`${s.showId}`} show={s} />
            ))}
          </div>
        </Container>
      </section>

      {/* ---- Upcoming + browse ---- */}
      <section className="border-t border-line">
        <Container className="grid gap-12 py-16 lg:grid-cols-[1.3fr_1fr]">
          {upcoming.length > 0 && (
            <div>
              <SectionHeader eyebrow="On the road" title="Upcoming shows" />
              <ul className="surface-card divide-y divide-line-soft">
                {upcoming.map((s) => {
                  const dp = dateParts(s.date);
                  return (
                    <li key={`${s.showId}`}>
                      <Link
                        href={showHref(s.date, s.order)}
                        className="group flex items-center gap-4 px-4 py-4 transition hover:bg-surface-2"
                      >
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-line bg-bg text-center">
                          <span className="font-mono text-[0.6rem] uppercase text-gold-soft">{dp.month.slice(0, 3)}</span>
                          <span className="font-display text-lg leading-none text-ink">{dp.day}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-display text-base text-ink group-hover:text-gold">{s.venue}</div>
                          <div className="truncate text-sm text-muted">{locationLine(s.city, s.state, s.country)}</div>
                        </div>
                        <span className="font-mono text-xs text-faint">{dp.year}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div>
            <SectionHeader eyebrow="Find your way in" title="Browse the record" />
            <div className="flex flex-col gap-3">
              <BrowseLink href="/shows" icon={<Calendar className="h-5 w-5" />} title="Every show" sub={`${compact(stats.showsPlayed)} nights, by year & tour`} />
              <BrowseLink href="/venues" icon={<MapPin className="h-5 w-5" />} title="Venues" sub={`${compact(stats.venues)} rooms across the map`} />
              <BrowseLink href="/tours" icon={<Disc className="h-5 w-5" />} title="Tours" sub="Runs and eras, start to finish" />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function BrowseLink({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-lg border border-line bg-surface px-5 py-4 transition hover:-translate-y-0.5 hover:border-gold/55 hover:bg-surface-2"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line text-gold transition group-hover:border-gold">
        {icon}
      </span>
      <div className="flex-1">
        <div className="font-display text-lg text-ink group-hover:text-gold">{title}</div>
        <div className="text-sm text-muted">{sub}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-gold" />
    </Link>
  );
}
