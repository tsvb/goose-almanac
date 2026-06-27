import Link from "next/link";
import { Container } from "./container";
import { SearchBox } from "./search-box";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";
import { Feather } from "./marks";

const NAV = [
  { href: "/shows", label: "Shows" },
  { href: "/on-this-day", label: "On This Day" },
  { href: "/venues", label: "Venues" },
  { href: "/tours", label: "Tours" },
];

export function SiteHeader() {
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

        <nav className="hidden items-center gap-7 text-[0.9rem] text-muted md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="relative py-1 transition hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <SearchBox />
          <ThemeToggle />
          <MobileNav />
        </div>
      </Container>
    </header>
  );
}
