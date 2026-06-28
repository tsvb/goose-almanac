"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Search } from "./marks";
import { ExperienceSwitcher } from "./experience-switcher";
import type { Experience } from "@/lib/experience";

const NAV = [
  { href: "/shows", label: "Shows" },
  { href: "/songs", label: "Songs" },
  { href: "/stats", label: "Stats" },
  { href: "/on-this-day", label: "On This Day" },
  { href: "/venues", label: "Venues" },
  { href: "/tours", label: "Tours" },
];

export function MobileNav({ experience }: { experience: Experience }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) {
      setOpen(false);
      router.push(`/search?q=${encodeURIComponent(term)}`);
    }
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted transition hover:border-gold hover:text-gold"
      >
        {open ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-16 z-30 cursor-default bg-bg-deep/50"
          />
          <div className="fixed inset-x-0 top-16 z-40 border-b border-line bg-bg shadow-[0_24px_48px_-20px_var(--shadow)]">
            <div className="space-y-5 px-5 py-6">
              <form onSubmit={submit} className="group relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint group-focus-within:text-gold" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search shows, venues, cities…"
                  aria-label="Search the almanac"
                  className="w-full rounded-full border border-line bg-surface py-3 pl-10 pr-4 text-ink placeholder:text-faint outline-none focus:border-gold"
                />
              </form>
              <div>
                <span className="mb-2 block font-mono text-[0.62rem] uppercase tracking-wider text-faint">Experience</span>
                <ExperienceSwitcher current={experience} />
              </div>
              <nav className="flex flex-col">
                {NAV.map((n) => {
                  const active = pathname === n.href || pathname.startsWith(n.href + "/");
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className={`border-b border-line-soft py-3 font-display text-xl last:border-0 ${
                        active ? "text-gold" : "text-ink"
                      }`}
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
