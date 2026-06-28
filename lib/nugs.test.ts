import { describe, it, expect } from "vitest";
import { nugsShowHref, nugsTrackHref, nugsWebFallback, NUGS_SCHEME } from "./nugs";

describe("nugs URL builders", () => {
  it("scheme constant", () => {
    expect(NUGS_SCHEME).toBe("applenugs");
  });
  it("show href: artist always Goose; venue %20-encoded; audio default omitted", () => {
    expect(nugsShowHref({ date: "2024-04-20" })).toBe("applenugs://show/2024-04-20?artist=Goose");
    expect(nugsShowHref({ date: "2024-04-20", venue: "The Salt Shed" }))
      .toBe("applenugs://show/2024-04-20?artist=Goose&venue=The%20Salt%20Shed");
    expect(nugsShowHref({ date: "2024-04-20", media: "audio" })).not.toContain("media=");
    expect(nugsShowHref({ date: "2024-04-20", media: "video" }))
      .toBe("applenugs://show/2024-04-20?artist=Goose&media=video");
  });
  it("track href: song/set/pos, %20-encoded, fixed key order", () => {
    expect(nugsTrackHref({ date: "2024-04-20", song: "Hot Tea", set: "1", pos: 2 }))
      .toBe("applenugs://show/2024-04-20?artist=Goose&song=Hot%20Tea&set=1&pos=2");
    expect(nugsTrackHref({ date: "2024-04-20", song: "Hot Tea", set: "1", pos: 2, venue: "The Cap", media: "video" }))
      .toBe("applenugs://show/2024-04-20?artist=Goose&song=Hot%20Tea&set=1&pos=2&venue=The%20Cap&media=video");
  });
  it("never emits + for spaces (Swift URLComponents safety)", () => {
    expect(nugsTrackHref({ date: "2024-04-20", song: "Hot Tea" })).not.toContain("+");
  });
  it("web fallback: a reliable nugs.net web landing", () => {
    expect(nugsWebFallback({ date: "2024-04-20" })).toBe("https://play.nugs.net/");
  });
});
