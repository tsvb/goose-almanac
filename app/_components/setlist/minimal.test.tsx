import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SetlistMinimal } from "./minimal";
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

describe("SetlistMinimal (document)", () => {
  it("renders per-set tables, segue marks, and a jam footnote ref + note", () => {
    const html = renderToStaticMarkup(
      <SetlistMinimal entries={[
        entry({ song: "Hot Tea", transition: " > ", isJamchart: true, jamchartNotes: "huge jam", trackTime: "14:32" }),
        entry({ song: "Arrow", position: 2 }),
      ]} showDate="2024-04-20" venue={null} />,
    );
    expect(html).toContain("<table");
    expect(html).toContain("Hot Tea");
    expect(html).toContain("&gt;");      // segue
    expect(html).toContain("<sup");      // footnote ref
    expect(html).toContain("huge jam");  // footnote text
    expect(html).not.toContain("<svg");
  });
  it("links the song and marks a Dusted Off return", () => {
    const html = renderToStaticMarkup(<SetlistMinimal entries={[entry({ song: "Hot Tea", slug: "hot-tea", gap: 52, isDustedOff: true })]} showDate="2024-04-20" venue={null} />);
    expect(html).toContain('href="/songs/hot-tea"');
    expect(html).toContain("Dusted Off");
  });
  it("emits a per-track applenugs link", () => {
    const html = renderToStaticMarkup(
      <SetlistMinimal
        entries={[entry({ song: "Hot Tea", setNumber: "1", position: 2 })]}
        showDate="2024-04-20"
        venue="The Salt Shed"
      />,
    );
    expect(html).toContain('href="applenugs://show/2024-04-20');
    expect(html).toContain("song=Hot%20Tea");
    expect(html).toContain("set=1");
    expect(html).toContain("pos=2");
  });
});
