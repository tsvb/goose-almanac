import Link from "next/link";
import { Container } from "./container";
import { Feather } from "./marks";
import { getExperience } from "@/lib/experience.server";

export function FooterFancy() {
  return (
    <footer className="mt-28 border-t border-line">
      <Container className="grid gap-10 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2 text-gold">
            <Feather className="h-5 w-5" />
            <span className="font-display text-lg text-ink">
              Goose <span className="italic text-gold">Almanac</span>
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            An almanac of every Goose show — setlists, segues, jams, venues, and the story of
            each night.
          </p>
        </div>
        <nav className="flex flex-col gap-2 text-sm text-muted">
          <span className="eyebrow mb-1">Browse</span>
          <Link href="/shows" className="transition hover:text-ink">All shows</Link>
          <Link href="/on-this-day" className="transition hover:text-ink">On this day</Link>
          <Link href="/venues" className="transition hover:text-ink">Venues</Link>
          <Link href="/tours" className="transition hover:text-ink">Tours</Link>
        </nav>
        <div className="flex flex-col gap-2 text-sm text-muted">
          <span className="eyebrow mb-1">Source</span>
          <p className="leading-relaxed">
            Setlist data courtesy of{" "}
            <a href="https://elgoose.net" className="link" target="_blank" rel="noreferrer">
              elgoose.net
            </a>
            . A non-commercial fan project.
          </p>
        </div>
      </Container>
      <div className="border-t border-line-soft">
        <Container className="flex flex-col items-center justify-between gap-2 py-5 text-xs text-faint sm:flex-row">
          <span className="font-mono">© {new Date().getFullYear()} Goose Almanac</span>
          <span className="font-mono">Not affiliated with Goose. Built by fans.</span>
        </Container>
      </div>
    </footer>
  );
}

export function FooterFunctional() {
  return (
    <footer className="mt-16 w2-appbar">
      <div style={{ textShadow: "0 -1px 0 rgba(0,0,0,.2)" }}>
        <Container className="flex flex-col items-center justify-between gap-2 py-4 text-xs text-white sm:flex-row">
          <span>© {new Date().getFullYear()} Goose Almanac · data from elgoose.net</span>
          <span>Not affiliated with Goose. Built by fans.</span>
        </Container>
      </div>
    </footer>
  );
}

export function FooterMinimal() {
  return (
    <footer className="mt-16 border-t border-line">
      <Container className="py-6 text-sm text-muted">
        Goose Almanac — setlist data from{" "}
        <a href="https://elgoose.net" target="_blank" rel="noreferrer">elgoose.net</a>. A
        non-commercial fan project, not affiliated with Goose.
      </Container>
    </footer>
  );
}

export async function SiteFooter() {
  const experience = await getExperience();
  if (experience === "minimal") return <FooterMinimal />;
  if (experience === "functional") return <FooterFunctional />;
  return <FooterFancy />;
}
