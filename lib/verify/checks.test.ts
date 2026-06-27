import { describe, it, expect } from "vitest";
import {
  checkFloors, checkIntegrity, checkSpotShow, checkEarliestShow, summarize,
} from "./checks";

describe("checkFloors", () => {
  it("passes when all above floors, fails the low one", () => {
    const ok = checkFloors({ shows: 853, songs: 613, venues: 591, performances: 15000 });
    expect(ok.every((r) => r.pass)).toBe(true);
    const bad = checkFloors({ shows: 10, songs: 613, venues: 591, performances: 15000 });
    expect(bad.find((r) => r.name === "shows floor")!.pass).toBe(false);
  });
});

describe("checkIntegrity", () => {
  it("passes only with zero orphans/dups", () => {
    expect(checkIntegrity({ perfNoShow: 0, perfNoSong: 0, showNoVenue: 0, dupPositions: 0 })
      .every((r) => r.pass)).toBe(true);
    expect(checkIntegrity({ perfNoShow: 3, perfNoSong: 0, showNoVenue: 0, dupPositions: 0 })
      .find((r) => r.name === "performances reference a show")!.pass).toBe(false);
  });
});

describe("checkSpotShow", () => {
  it("passes for 15 acoustic performances", () => {
    expect(checkSpotShow({ performanceCount: 15, notes: "first set acoustic" }).pass).toBe(true);
    expect(checkSpotShow({ performanceCount: 12, notes: "first set acoustic" }).pass).toBe(false);
    expect(checkSpotShow({ performanceCount: 15, notes: null }).pass).toBe(false);
  });
});

describe("checkEarliestShow", () => {
  it("expects 2012-01-12", () => {
    expect(checkEarliestShow("2012-01-12").pass).toBe(true);
    expect(checkEarliestShow("2014-01-01").pass).toBe(false);
  });
});

describe("summarize", () => {
  it("ok only when every result passes", () => {
    expect(summarize([{ name: "a", pass: true, detail: "" }]).ok).toBe(true);
    expect(summarize([{ name: "a", pass: true, detail: "" }, { name: "b", pass: false, detail: "" }]).ok)
      .toBe(false);
  });
});
