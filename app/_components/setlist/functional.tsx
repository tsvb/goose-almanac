"use client";

import { useMemo, useState } from "react";
import { groupSets, isSegue } from "./shared";
import type { SetlistEntry } from "@/lib/queries/shows";
import { trackSeconds, RETURN_LABEL } from "@/lib/queries/format";
import { NugsLink } from "../nugs-link";
import { nugsTrackHref, nugsWebFallback } from "@/lib/nugs";

type Sort = "set" | "long" | "az";

export function SetlistFunctional({ entries, showDate, venue }: { entries: SetlistEntry[]; showDate: string; venue: string | null }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("set");
  const [jamsOnly, setJamsOnly] = useState(false);

  const rows = useMemo(() => {
    const groups = groupSets(entries);
    let flat = groups.flatMap((g) => g.entries.map((e, i) => ({ e, set: i === 0 ? g.label : "", n: i + 1 })));
    if (q.trim()) flat = flat.filter((r) => r.e.song.toLowerCase().includes(q.trim().toLowerCase()));
    if (jamsOnly) flat = flat.filter((r) => r.e.isJamchart);
    if (sort === "az") flat = [...flat].sort((a, b) => a.e.song.localeCompare(b.e.song));
    if (sort === "long") flat = [...flat].sort((a, b) => (trackSeconds(b.e.trackTime) ?? 0) - (trackSeconds(a.e.trackTime) ?? 0));
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
          placeholder="Filter songs…"
          aria-label="Filter songs"
          className="h-8 min-w-[8rem] flex-1 rounded-full border border-[#aebfce] bg-white px-4 text-sm text-ink shadow-[inset_0_1px_2px_rgba(0,0,0,0.09)] outline-none"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="gel border-0 text-xs">
          <option value="set">Sort: Set order</option>
          <option value="long">Sort: Longest</option>
          <option value="az">Sort: A–Z</option>
        </select>
        <button type="button" onClick={() => setJamsOnly((v) => !v)} aria-pressed={jamsOnly} className={`gel green text-xs ${jamsOnly ? "" : "opacity-75"}`}>
          ★ Jams only
        </button>
      </div>
      <table className="w2-table text-sm">
        <thead>
          <tr>
            <th>Set</th>
            <th>#</th>
            <th className="w-full">Song</th>
            <th aria-label="Segue">→</th>
            <th className="text-right">Time</th>
            <th>Jam</th>
            <th aria-label="Listen"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.e.uniqueId} className="nugs-row">
              <td className="text-faint">{r.set}</td>
              <td className="tabular-nums text-faint">{r.n}</td>
              <td className="font-semibold text-ink">
                {r.e.slug ? <a href={`/songs/${r.e.slug}`} className="hover:underline">{r.e.song}</a> : r.e.song}
                {r.e.isDustedOff ? <span className="w2-badge gold ml-2">{RETURN_LABEL} · {r.e.gap}</span> : null}
              </td>
              <td className="font-extrabold text-gold">{isSegue(r.e.transition) ? "›" : ""}</td>
              <td className="text-right tabular-nums text-muted">{r.e.trackTime ?? "—"}</td>
              <td>{r.e.isJamchart ? <span className="w2-star">★ JAM</span> : <span className="text-faint">·</span>}</td>
              <td>
                <NugsLink
                  href={nugsTrackHref({ date: showDate, venue, song: r.e.song, set: r.e.setNumber, pos: r.e.position })}
                  fallback={nugsWebFallback({ date: showDate, venue })}
                  className="nugs-track"
                  title={`Listen to ${r.e.song} on nugs`}
                >▷</NugsLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
