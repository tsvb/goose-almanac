import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SetlistFunctional } from "./functional";
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

describe("SetlistFunctional", () => {
  it("renders a table with a segue arrow and the song name", () => {
    const html = renderToStaticMarkup(
      <SetlistFunctional entries={[
        entry({ song: "Tumble", transition: " > ", trackTime: "18:40" }),
        entry({ song: "Yeti", position: 2 }),
      ]} />,
    );
    expect(html).toContain("<table");
    expect(html).toContain("Tumble");
    expect(html).toContain("›"); // segue marker
    expect(html).toContain("18:40");
  });

  it("renders filter controls and all rows initially", () => {
    const html = renderToStaticMarkup(
      <SetlistFunctional entries={[entry({ song: "Tumble" }), entry({ song: "Yeti", position: 2 })]} />,
    );
    expect(html).toContain("Filter songs");
    expect(html).toContain("Tumble");
    expect(html).toContain("Yeti");
  });
  it("links the song and marks a Dusted Off return", () => {
    const html = renderToStaticMarkup(<SetlistFunctional entries={[entry({ song: "Hot Tea", slug: "hot-tea", gap: 52, isDustedOff: true })]} />);
    expect(html).toContain('href="/songs/hot-tea"');
    expect(html).toContain("Dusted Off");
  });
});
