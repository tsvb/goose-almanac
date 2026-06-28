import { describe, it, expect } from "vitest";
import { slugifySongName, songHref, RETURN_LABEL } from "./format";

describe("song slugs", () => {
  it("slugifies names", () => {
    expect(slugifySongName("Hot Tea")).toBe("hot-tea");
    expect(slugifySongName("Bob Dylan's Dream")).toBe("bob-dylans-dream");
    expect(slugifySongName("Arcadia (Reprise)")).toBe("arcadia-reprise");
  });
  it("songHref prefers slug", () => {
    expect(songHref({ slug: "hot-tea" })).toBe("/songs/hot-tea");
    expect(RETURN_LABEL).toBe("Dusted Off");
  });
});
