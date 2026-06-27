import { describe, it, expect } from "vitest";
import songs from "./__fixtures__/songs.json";
import venues from "./__fixtures__/venues.json";
import setlists from "./__fixtures__/setlists.2022-06-24.json";
import type { ElgooseEnvelope, RawSong, RawVenue, RawSetlistRow } from "./types";

describe("fixtures match expected envelope + key shapes", () => {
  it("songs fixture has id/name/slug", () => {
    const env = songs as ElgooseEnvelope<RawSong>;
    expect(env.error).toBe(false);
    expect(env.data.length).toBeGreaterThan(0);
    const s = env.data[0];
    expect(typeof s.id).toBe("number");
    expect(typeof s.name).toBe("string");
    expect(typeof s.slug).toBe("string");
  });

  it("venues fixture has venue_id/venuename", () => {
    const env = venues as ElgooseEnvelope<RawVenue>;
    expect(typeof env.data[0].venue_id).toBe("number");
    expect(typeof env.data[0].venuename).toBe("string");
  });

  it("setlists fixture for 2022-06-24 is the 15-song acoustic Radio City show", () => {
    const env = setlists as ElgooseEnvelope<RawSetlistRow>;
    expect(env.data.length).toBe(15);
    expect(env.data[0].venuename ?? "").toContain("Radio City");
    expect(env.data[0].shownotes).toContain("acoustic");
  });
});
