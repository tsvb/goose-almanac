import type { SetlistEntry } from "@/lib/queries/shows";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

// elgoose convention: set_type is "Set" or "One Set"; set_number is "1".."n"
// for sets and "e" / "e2" for encores.
export function setLabel(type: string | null, num: string | null): string {
  const n = (num ?? "").trim().toLowerCase();
  if (type === "Soundcheck") return "Soundcheck";
  if (type === "One Set") return "Set";
  if (n.startsWith("e")) {
    const idx = parseInt(n.slice(1), 10);
    return Number.isFinite(idx) && idx > 1 ? `Encore ${ROMAN[idx] ?? idx}` : "Encore";
  }
  const setNo = parseInt(n, 10);
  if (Number.isFinite(setNo)) return `Set ${ROMAN[setNo] ?? setNo}`;
  return type ?? "Set";
}

export const isSegue = (t: string | null): boolean => !!t && t.includes(">");

export type SetGroup = { key: string; label: string; entries: SetlistEntry[] };

export function groupSets(entries: SetlistEntry[]): SetGroup[] {
  const groups: SetGroup[] = [];
  for (const e of entries) {
    const key = `${e.setType}|${e.setNumber}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(e);
    else groups.push({ key, label: setLabel(e.setType, e.setNumber), entries: [e] });
  }
  return groups;
}
