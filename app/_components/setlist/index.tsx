import type { SetlistEntry } from "@/lib/queries/shows";
import type { Experience } from "@/lib/experience";
import { SetlistFancy } from "./fancy";
import { SetlistFunctional } from "./functional";
import { SetlistMinimal } from "./minimal";

export function Setlist({
  entries, experience, showDate, venue,
}: {
  entries: SetlistEntry[];
  experience: Experience;
  showDate: string;
  venue: string | null;
}) {
  if (experience === "functional") return <SetlistFunctional entries={entries} showDate={showDate} venue={venue} />;
  if (experience === "minimal") return <SetlistMinimal entries={entries} showDate={showDate} venue={venue} />;
  return <SetlistFancy entries={entries} showDate={showDate} venue={venue} />;
}
