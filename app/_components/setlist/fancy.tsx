import Link from "next/link";
import { Flame } from "../marks";
import { clsx } from "../clsx";
import { trackSeconds, formatDuration, RETURN_LABEL } from "@/lib/queries/format";
import type { SetlistEntry } from "@/lib/queries/shows";
import { groupSets, isSegue } from "./shared";

export function SetlistFancy({ entries }: { entries: SetlistEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface/50 px-5 py-8 text-center text-muted">
        No setlist has been recorded for this show yet.
      </p>
    );
  }
  const groups = groupSets(entries);

  return (
    <div className="space-y-10">
      {groups.map((g) => {
        const secs = g.entries.map((e) => trackSeconds(e.trackTime)).filter((s): s is number => s != null);
        const total = secs.length >= Math.ceil(g.entries.length / 2) ? secs.reduce((a, b) => a + b, 0) : null;

        return (
          <section key={g.key}>
            <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-line pb-2">
              <h3 className="font-display text-xl text-ink">{g.label}</h3>
              <span className="font-mono text-[0.7rem] text-faint">
                {g.entries.length} {g.entries.length === 1 ? "song" : "songs"}
                {total ? ` · ${formatDuration(total)}` : ""}
              </span>
            </div>

            <ol>
              {g.entries.map((e, i) => {
                const prev = g.entries[i - 1];
                const segFromPrev = prev ? isSegue(prev.transition) : false;
                const segToNext = isSegue(e.transition);
                const inRun = segFromPrev || segToNext;
                const thread =
                  segFromPrev && segToNext
                    ? "before:top-0 before:h-full"
                    : segFromPrev
                      ? "before:top-0 before:h-1/2"
                      : "before:top-1/2 before:h-1/2";

                return (
                  <li
                    key={e.uniqueId}
                    className={clsx(
                      "group relative flex items-baseline gap-3 py-[7px] pl-4",
                      inRun &&
                        "before:absolute before:left-[1px] before:w-[2px] before:rounded-full before:bg-gold/45",
                      inRun && thread,
                    )}
                  >
                    <span className="w-5 shrink-0 text-right font-mono text-[0.7rem] tabular-nums text-faint">
                      {i + 1}
                    </span>
                    <span className="flex-1 leading-snug">
                      {segFromPrev && <span className="mr-1 select-none text-gold">›</span>}
                      {e.slug
                        ? <Link href={`/songs/${e.slug}`} className="text-[1.02rem] text-ink hover:underline">{e.song}</Link>
                        : <span className="text-[1.02rem] text-ink">{e.song}</span>}
                      {e.isJamchart && (
                        <span title={e.jamchartNotes ?? "Jam chart"}>
                          <Flame className="ml-1.5 inline h-[15px] w-[15px] -translate-y-px text-gold" strokeWidth={1.7} />
                        </span>
                      )}
                      {e.isDustedOff && <span className="ml-2 rounded-full border border-gold/40 px-2 py-0.5 align-middle font-mono text-[0.6rem] text-gold">{RETURN_LABEL} · {e.gap}</span>}
                      {!e.isOriginal && e.originalArtist && (
                        <span className="ml-2 align-baseline text-xs italic text-faint">{e.originalArtist}</span>
                      )}
                      {e.footnote && (
                        <span className="ml-1 cursor-help align-super text-[0.6rem] text-sage" title={e.footnote}>
                          °
                        </span>
                      )}
                    </span>
                    {e.trackTime && (
                      <span className="shrink-0 font-mono text-[0.72rem] tabular-nums text-muted">{e.trackTime}</span>
                    )}
                  </li>
                );
              })}
            </ol>

            {g.entries.some((e) => e.isJamchart && e.jamchartNotes) && (
              <ul className="mt-4 space-y-2 border-t border-line-soft pt-3">
                {g.entries
                  .filter((e) => e.isJamchart && e.jamchartNotes)
                  .map((e) => (
                    <li key={e.uniqueId} className="flex gap-2.5 text-[0.82rem] leading-relaxed text-muted">
                      <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={1.7} />
                      <span>
                        <span className="text-ink">{e.song}</span> — {e.jamchartNotes}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
