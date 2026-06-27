import { groupSets, isSegue } from "./shared";
import type { SetlistEntry } from "@/lib/queries/shows";

export function SetlistMinimal({ entries }: { entries: SetlistEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted">No setlist has been recorded for this show yet.</p>;
  }
  const groups = groupSets(entries);
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="mb-1 font-display text-lg text-ink">{g.label}</h3>
          <ol className="list-decimal space-y-0.5 pl-6 text-ink">
            {g.entries.map((e) => (
              <li key={e.uniqueId}>
                {e.song}
                {!e.isOriginal && e.originalArtist ? ` (${e.originalArtist})` : ""}
                {isSegue(e.transition) ? " > " : ""}
                {e.isJamchart ? " · jam" : ""}
                {e.trackTime ? ` (${e.trackTime})` : ""}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
