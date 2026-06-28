import Link from "next/link";
import { Container } from "./container";
import { SearchBox } from "./search-box";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";
import { ExperienceSwitcher } from "./experience-switcher";
import { Feather } from "./marks";
import { getExperience } from "@/lib/experience.server";
import { allowsTheme, type Experience } from "@/lib/experience";

const NAV = [
  { href: "/shows", label: "Shows" },
  { href: "/songs", label: "Songs" },
  { href: "/stats", label: "Stats" },
  { href: "/on-this-day", label: "On This Day" },
  { href: "/venues", label: "Venues" },
  { href: "/tours", label: "Tours" },
];

export function HeaderFancy({ experience }: { experience: Experience }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-2.5 shrink-0">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-line text-gold transition group-hover:border-gold group-hover:rotate-[8deg]">
            <Feather className="h-[18px] w-[18px]" />
          </span>
          <span className="font-display text-[1.15rem] leading-none tracking-tight">
            Goose <span className="italic text-gold">Almanac</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-4 text-[0.9rem] text-muted lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="relative whitespace-nowrap py-1 transition hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><ExperienceSwitcher current={experience} /></div>
          <SearchBox />
          {allowsTheme(experience) && <ThemeToggle />}
          <MobileNav experience={experience} />
        </div>
      </Container>
    </header>
  );
}

export function HeaderFunctional({ experience }: { experience: Experience }) {
  return (
    <header className="w2-appbar sticky top-0 z-40">
      <Container className="flex h-12 items-center justify-between gap-4">
        <Link href="/" className="w2-brand flex items-center text-[1.05rem]">
          Goose Almanac<span className="w2-beta">BETA</span>
        </Link>
        <nav className="hidden items-center gap-1 text-[0.8rem] lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="w2-navlink whitespace-nowrap">{n.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><ExperienceSwitcher current={experience} /></div>
          <SearchBox />
          {allowsTheme(experience) && <ThemeToggle />}
          <MobileNav experience={experience} />
        </div>
      </Container>
    </header>
  );
}

export function HeaderMinimal({ experience }: { experience: Experience }) {
  return (
    <header className="border-b border-line">
      <Container className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
        <Link href="/" className="font-medium underline">Goose Almanac</Link>
        <span className="text-faint" aria-hidden>·</span>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="underline">{n.label}</Link>
        ))}
        <Link href="/search" className="underline">Search</Link>
        <span className="ml-auto"><ExperienceSwitcher current={experience} /></span>
      </Container>
    </header>
  );
}

export async function SiteHeader() {
  const experience = await getExperience();
  if (experience === "minimal") return <HeaderMinimal experience={experience} />;
  if (experience === "functional") return <HeaderFunctional experience={experience} />;
  return <HeaderFancy experience={experience} />;
}
