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
    originalArtist: null, footnote: null, ...p,
  };
}

describe("SetlistMinimal", () => {
  it("renders a semantic ordered list with inline segue and jam markers", () => {
    const html = renderToStaticMarkup(
      <SetlistMinimal entries={[
        entry({ song: "Hot Tea", transition: " > ", isJamchart: true, trackTime: "14:32" }),
        entry({ song: "Arrow", position: 2 }),
      ]} />,
    );
    expect(html).toContain("<ol");
    expect(html).toContain("<li");
    expect(html).toContain("Hot Tea");
    expect(html).toContain("&gt;"); // inline segue, HTML-escaped
    expect(html).toContain("jam");
    expect(html).toContain("(14:32)");
    expect(html).not.toContain("<svg"); // no decorative marks
  });
});
