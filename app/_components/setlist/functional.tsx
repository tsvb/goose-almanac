"use client";

import { useMemo, useState } from "react";
import { Flame } from "../marks";
import { groupSets, isSegue } from "./shared";
import type { SetlistEntry } from "@/lib/queries/shows";
import { trackSeconds } from "@/lib/queries/format";

type Sort = "set" | "long" | "az";

export function SetlistFunctional({ entries }: { entries: SetlistEntry[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("set");
  const [jamsOnly, setJamsOnly] = useState(false);

  const rows = useMemo(() => {
    const groups = groupSets(entries);
    let flat = groups.flatMap((g) =>
      g.entries.map((e, i) => ({ e, set: i === 0 ? g.label : "", n: i + 1 })),
    );
    if (q.trim()) flat = flat.filter((r) => r.e.song.toLowerCase().includes(q.trim().toLowerCase()));
    if (jamsOnly) flat = flat.filter((r) => r.e.isJamchart);
    if (sort === "az") flat = [...flat].sort((a, b) => a.e.song.localeCompare(b.e.song));
    if (sort === "long")
      flat = [...flat].sort((a, b) => (trackSeconds(b.e.trackTime) ?? 0) - (trackSeconds(a.e.trackTime) ?? 0));
    return flat;
  }, [entries, q, sort, jamsOnly]);

  if (entries.length === 0) {
    return <p className="text-muted">No setlist has been recorded for this show yet.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter songs"
          aria-label="Filter songs"
          className="h-8 min-w-[8rem] flex-1 rounded border border-line bg-surface px-2 font-mono text-sm text-ink outline-none focus:border-gold"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort"
          className="h-8 rounded border border-line bg-surface px-2 font-mono text-sm text-muted"
        >
          <option value="set">Set order</option>
          <option value="long">Longest</option>
          <option value="az">A–Z</option>
        </select>
        <label className="flex items-center gap-1.5 font-mono text-xs text-muted">
          <input type="checkbox" checked={jamsOnly} onChange={(e) => setJamsOnly(e.target.checked)} /> jams
        </label>
      </div>
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
          {rows.map((r) => (
            <tr key={r.e.uniqueId} className="border-b border-line-soft align-baseline">
              <td className="py-1.5 pr-3 text-faint">{r.set}</td>
              <td className="py-1.5 pr-3 tabular-nums text-faint">{r.n}</td>
              <td className="py-1.5 pr-3 text-ink">{r.e.song}</td>
              <td className="py-1.5 pr-3 text-gold">{isSegue(r.e.transition) ? "›" : ""}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-muted">{r.e.trackTime ?? "—"}</td>
              <td className="py-1.5">
                {r.e.isJamchart ? <Flame className="inline h-3.5 w-3.5 text-gold" strokeWidth={1.7} /> : <span className="text-faint">·</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
