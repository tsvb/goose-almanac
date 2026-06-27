import { describe, it, expect } from "vitest";
import {
  resolveExperience,
  allowsTheme,
  serializeExperienceCookie,
  DEFAULT_EXPERIENCE,
  EXPERIENCES,
} from "./experience";

describe("resolveExperience", () => {
  it("accepts each valid value", () => {
    expect(resolveExperience("fancy")).toBe("fancy");
    expect(resolveExperience("functional")).toBe("functional");
    expect(resolveExperience("minimal")).toBe("minimal");
  });
  it("falls back to the default for missing or unknown values", () => {
    expect(resolveExperience(undefined)).toBe(DEFAULT_EXPERIENCE);
    expect(resolveExperience(null)).toBe(DEFAULT_EXPERIENCE);
    expect(resolveExperience("")).toBe(DEFAULT_EXPERIENCE);
    expect(resolveExperience("FANCY")).toBe(DEFAULT_EXPERIENCE);
    expect(resolveExperience("rainbow")).toBe(DEFAULT_EXPERIENCE);
  });
});

describe("allowsTheme", () => {
  it("is true except in minimal", () => {
    expect(allowsTheme("fancy")).toBe(true);
    expect(allowsTheme("functional")).toBe(true);
    expect(allowsTheme("minimal")).toBe(false);
  });
});

describe("serializeExperienceCookie", () => {
  it("produces a year-long, path-scoped, lax cookie string", () => {
    const c = serializeExperienceCookie("minimal");
    expect(c).toContain("ga_experience=minimal");
    expect(c).toContain("path=/");
    expect(c).toContain("max-age=31536000");
    expect(c.toLowerCase()).toContain("samesite=lax");
  });
});

describe("EXPERIENCES", () => {
  it("lists the three modes in order with labels", () => {
    expect(EXPERIENCES.map((e) => e.key)).toEqual(["fancy", "functional", "minimal"]);
    expect(EXPERIENCES.map((e) => e.label)).toEqual(["Fancy", "Functional", "Minimal"]);
  });
});
