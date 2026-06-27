export type Experience = "fancy" | "functional" | "minimal";

export const EXPERIENCES: { key: Experience; label: string; blurb: string }[] = [
  { key: "fancy", label: "Fancy", blurb: "The full immersive Almanac" },
  { key: "functional", label: "Functional", blurb: "Dense, utility-first" },
  { key: "minimal", label: "Minimal", blurb: "Plain, fast, machine-readable" },
];

export const EXPERIENCE_COOKIE = "ga_experience";
export const DEFAULT_EXPERIENCE: Experience = "fancy";

const KEYS: Experience[] = ["fancy", "functional", "minimal"];

export function resolveExperience(value: string | null | undefined): Experience {
  return KEYS.includes(value as Experience) ? (value as Experience) : DEFAULT_EXPERIENCE;
}

export function allowsTheme(experience: Experience): boolean {
  return experience !== "minimal";
}

export function serializeExperienceCookie(experience: Experience): string {
  return `${EXPERIENCE_COOKIE}=${experience}; path=/; max-age=31536000; samesite=lax`;
}
