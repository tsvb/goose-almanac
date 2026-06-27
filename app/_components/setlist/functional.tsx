import { Flame } from "../marks";
import { groupSets, isSegue } from "./shared";
import type { SetlistEntry } from "@/lib/queries/shows";

export function SetlistFunctional({ entries }: { entries: SetlistEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted">No setlist has been recorded for this show yet.</p>;
  }
  const groups = groupSets(entries);
  return (
    <table className="w-full border-collapse font-mono text-sm">
      <thead>
        <tr className="border-b border-line text-left text-[0.66rem] uppercase tracking-wider text-faint">
          <th className="py-2 pr-3 font-normal">Set</th>
          <th className="py-2 pr-3 font-normal">#</th>
          <th className="w-full py-2 pr-3 font-normal">Song</th>
          <th className="py-2 pr-3 font-normal" aria-label="Segue">→</th>
          <th className="py-2 pr-3 text-right font-normal">Time</th>
          <th className="py-2 font-normal">Jam</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) =>
          g.entries.map((e, i) => (
            <tr key={e.uniqueId} className="border-b border-line-soft align-baseline">
              <td className="py-1.5 pr-3 text-faint">{i === 0 ? g.label : ""}</td>
              <td className="py-1.5 pr-3 tabular-nums text-faint">{i + 1}</td>
              <td className="py-1.5 pr-3 text-ink">{e.song}</td>
              <td className="py-1.5 pr-3 text-gold">{isSegue(e.transition) ? "›" : ""}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-muted">{e.trackTime ?? "—"}</td>
              <td className="py-1.5">
                {e.isJamchart ? (
                  <Flame className="inline h-3.5 w-3.5 text-gold" strokeWidth={1.7} />
                ) : (
                  <span className="text-faint">·</span>
                )}
              </td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}
