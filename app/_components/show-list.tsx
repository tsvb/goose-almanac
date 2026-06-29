import Link from "next/link";
import { ShowRow } from "./show-card";
import { showHref, locationLine } from "@/lib/queries/format";
import type { ShowSummary } from "@/lib/queries/shows";
import type { Experience } from "@/lib/experience";

export function ShowList({ rows, experience }: { rows: ShowSummary[]; experience: Experience }) {
  if (experience === "minimal") {
    return (
      <ul className="list-disc space-y-1 pl-6 text-ink">
        {rows.map((s) => {
          const loc = locationLine(s.city, s.state, s.country);
          return (
            <li key={s.showId}>
              <Link href={showHref(s.date, s.order)} className="underline">
                {s.date} — {s.venue ?? "Unknown venue"}
                {loc ? `, ${loc}` : ""}
              </Link>
              {s.songCount > 0 ? ` (${s.songCount} songs)` : ""}
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className="surface-card divide-y divide-line-soft">
      {rows.map((s) => (
        <li key={s.showId} id={`show-${s.showId}`} className="show-anchor">
          <ShowRow show={s} />
        </li>
      ))}
    </ul>
  );
}
