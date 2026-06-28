import { groupSets, isSegue } from "./shared";
import { Footnotes, DocSection } from "../doc";
import type { SetlistEntry } from "@/lib/queries/shows";
import { RETURN_LABEL } from "@/lib/queries/format";

export function SetlistMinimal({ entries }: { entries: SetlistEntry[] }) {
  if (entries.length === 0) {
    return <p>No setlist has been recorded for this show yet.</p>;
  }
  const groups = groupSets(entries);
  const notes: { id: string; text: string }[] = [];
  entries.forEach((e) => {
    if (e.isJamchart && e.jamchartNotes) notes.push({ id: `n-${e.uniqueId}`, text: `${e.song} — ${e.jamchartNotes}` });
  });
  const noteIndex = new Map(notes.map((n, i) => [n.id, i + 1]));

  return (
    <div>
      {groups.map((g) => (
        <DocSection key={g.key} title={g.label}>
          <table className="doc-table">
            <tbody>
              {g.entries.map((e, i) => {
                const nid = `n-${e.uniqueId}`;
                const fn = e.isJamchart && e.jamchartNotes ? noteIndex.get(nid) : undefined;
                return (
                  <tr key={e.uniqueId}>
                    <td className="num" style={{ width: "1.6rem" }}>{i + 1}</td>
                    <td>
                      {e.slug ? <a href={`/songs/${e.slug}`}>{e.song}</a> : e.song}
                      {fn ? <sup><a href={`#${nid}`}>{fn}</a></sup> : null}
                      {isSegue(e.transition) ? " >" : ""}
                      {e.isDustedOff ? <span className="doc-crumb"> [{RETURN_LABEL} · {e.gap}]</span> : null}
                    </td>
                    <td className="num">{e.trackTime ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DocSection>
      ))}
      {notes.length > 0 && (
        <DocSection title="Jam notes">
          <Footnotes notes={notes} />
        </DocSection>
      )}
    </div>
  );
}
