import type { ShowDetail, SetlistEntry } from "@/lib/queries/shows";
import { locationLine } from "@/lib/queries/format";

export function showJsonLd(show: ShowDetail, setlist: SetlistEntry[]): object {
  const address = locationLine(show.city, show.state, show.country);
  return {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: `Goose at ${show.venue ?? "an unknown venue"}`,
    startDate: show.date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(show.venue
      ? {
          location: {
            "@type": "MusicVenue",
            name: show.venue,
            ...(address ? { address } : {}),
          },
        }
      : {}),
    performer: { "@type": "MusicGroup", name: "Goose" },
    workPerformed: setlist.map((e) => ({ "@type": "MusicComposition", name: e.song })),
  };
}

export function siteJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Goose Almanac",
    description: "An almanac of every Goose show: setlists, venues, tours, and stats.",
    about: { "@type": "MusicGroup", name: "Goose" },
  };
}
