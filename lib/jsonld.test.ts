import { describe, it, expect } from "vitest";
import { showJsonLd, siteJsonLd } from "./jsonld";
import type { ShowDetail, SetlistEntry } from "@/lib/queries/shows";

const show: ShowDetail = {
  showId: 1, date: "2025-06-28", order: null, venue: "Madison Square Garden",
  city: "New York", state: "NY", country: "USA", tour: null, tourId: null,
  songCount: 2, hasNotes: false, venueId: 9, permalink: null, notes: null,
};
const setlist = [
  { song: "Madhuvan" }, { song: "Hot Tea" },
] as SetlistEntry[];

describe("showJsonLd", () => {
  it("builds a MusicEvent with venue, performer, and ordered songs", () => {
    const ld = showJsonLd(show, setlist) as Record<string, unknown>;
    expect(ld["@type"]).toBe("MusicEvent");
    expect(ld.startDate).toBe("2025-06-28");
    expect((ld.name as string)).toContain("Madison Square Garden");
    expect((ld.performer as Record<string, unknown>).name).toBe("Goose");
    const works = ld.workPerformed as { name: string }[];
    expect(works.map((w) => w.name)).toEqual(["Madhuvan", "Hot Tea"]);
  });
});

describe("siteJsonLd", () => {
  it("describes the site as a WebSite about Goose", () => {
    const ld = siteJsonLd() as Record<string, unknown>;
    expect(ld["@type"]).toBe("WebSite");
    expect((ld.about as Record<string, unknown>).name).toBe("Goose");
  });
});
