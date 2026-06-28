import { describe, it, expect } from "vitest";
import { groupSets, setLabel, isSegue, type SetGroup } from "./shared";
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

describe("setLabel", () => {
  it("names sets, encores, and one-set shows", () => {
    expect(setLabel("Set", "1")).toBe("Set I");
    expect(setLabel("Set", "2")).toBe("Set II");
    expect(setLabel("One Set", null)).toBe("Set");
    expect(setLabel("Encore", "e")).toBe("Encore");
    expect(setLabel("Encore", "e2")).toBe("Encore II");
    expect(setLabel("Soundcheck", null)).toBe("Soundcheck");
  });
});

describe("isSegue", () => {
  it("detects the '>' transition", () => {
    expect(isSegue(" > ")).toBe(true);
    expect(isSegue(",")).toBe(false);
    expect(isSegue(null)).toBe(false);
  });
});

describe("groupSets", () => {
  it("groups consecutive entries by set type+number", () => {
    const groups: SetGroup[] = groupSets([
      entry({ setType: "Set", setNumber: "1", song: "A" }),
      entry({ setType: "Set", setNumber: "1", song: "B" }),
      entry({ setType: "Encore", setNumber: "e", song: "C" }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Set I", "Encore"]);
    expect(groups[0].entries.map((e) => e.song)).toEqual(["A", "B"]);
  });
});
