"use client";

import { useRouter } from "next/navigation";
import { EXPERIENCES, serializeExperienceCookie, type Experience } from "@/lib/experience";
import { clsx } from "./clsx";

export function ExperienceSwitcher({ current }: { current: Experience }) {
  const router = useRouter();
  function choose(next: Experience) {
    if (next === current) return;
    document.cookie = serializeExperienceCookie(next);
    router.refresh();
  }
  return (
    <div role="group" aria-label="Experience mode" className="flex items-center rounded-full border border-line p-0.5">
      {EXPERIENCES.map((e) => (
        <button
          key={e.key}
          type="button"
          onClick={() => choose(e.key)}
          aria-pressed={current === e.key}
          title={e.blurb}
          className={clsx(
            "rounded-full px-2.5 py-1 font-mono text-[0.66rem] uppercase tracking-wider transition",
            current === e.key ? "bg-gold/15 text-gold" : "text-faint hover:text-ink",
          )}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}
