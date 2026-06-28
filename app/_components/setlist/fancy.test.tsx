import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SetlistFancy } from "./fancy";
import type { SetlistEntry } from "@/lib/queries/shows";

function entry(p: Partial<SetlistEntry>): SetlistEntry {
  return {
    uniqueId: Math.random().toString(36).slice(2),
    songId: 1, song: "X", slug: null, setType: "Set", setNumber: "1",
    position: 1, trackTime: null, transition: null, isJamchart: false,
    jamchartNotes: null, isJam: false, isReprise: false, isOriginal: true,
    originalArtist: null, footnote: null, gap: null, isDustedOff: false, ...p,
  };
}

describe("SetlistFancy", () => {
  it("renders an ordered list with song names and a jam flame", () => {
    const html = renderToStaticMarkup(
      <SetlistFancy entries={[entry({ song: "Madhuvan", isJamchart: true, jamchartNotes: "huge" })]} />,
    );
    expect(html).toContain("<ol");
    expect(html).toContain("Madhuvan");
    expect(html).toContain("<svg"); // the flame mark
  });
  it("renders an empty-state when there are no entries", () => {
    const html = renderToStaticMarkup(<SetlistFancy entries={[]} />);
    expect(html).toContain("No setlist");
  });
  it("links the song and marks a Dusted Off return", () => {
    const html = renderToStaticMarkup(<SetlistFancy entries={[entry({ song: "Hot Tea", slug: "hot-tea", gap: 52, isDustedOff: true })]} />);
    expect(html).toContain('href="/songs/hot-tea"');
    expect(html).toContain("Dusted Off");
  });
});
