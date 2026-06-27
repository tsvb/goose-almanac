# Experience Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each visitor choose how they experience the Goose Almanac — Fancy (default), Functional, or Minimal — as three presentations of the same content and routes.

**Architecture:** A presentation layer over the existing data/query layer. Mode is stored in a cookie, resolved server-side (the app is already `force-dynamic`), set as `data-experience` on `<html>`, and used to (a) pivot the CSS-variable design tokens per mode and (b) select per-mode renderers for the signature setlist and shows-list components. JSON-LD ships on content pages in every mode. The existing dark/light theme stays an orthogonal control.

**Tech Stack:** Next.js 15 (App Router, server components, `force-dynamic`), React 19, Tailwind v4 (CSS-var tokens via `@theme inline`), Drizzle/postgres (unchanged), Vitest (node env, offline), `react-dom/server` for component render tests.

## Global Constraints

- Node `>=22`. Do not add heavy dependencies; component tests use `react-dom/server` (already present via `react-dom`).
- Cookie name is exactly `ga_experience`; values are exactly `fancy | functional | minimal`; default is `fancy`.
- User-facing labels are exactly `Fancy`, `Functional`, `Minimal`.
- The existing theme system (`data-theme` attribute, `ga-theme` localStorage, `ThemeToggle`) stays as-is and orthogonal. Light/dark is hidden only in Minimal.
- All routes remain `force-dynamic` (already set in `app/layout.tsx`). No query-layer changes.
- Tailwind tokens are CSS variables defined in `app/globals.css` (`--ink`, `--gold`, `--font-display`, etc.); pivot modes by overriding these, never by hardcoding hex in components.
- `npm test`, `npm run typecheck`, and `npm run build` must all pass before shipping.
- Repo gotcha: never run `npm run build` while `npm run dev` is running (it clobbers `.next`). Stop dev first.

---

### Task 1: Experience model (pure, server-agnostic)

**Files:**
- Create: `lib/experience.ts`
- Test: `lib/experience.test.ts`

**Interfaces:**
- Produces: `type Experience = "fancy" | "functional" | "minimal"`; `EXPERIENCES: { key: Experience; label: string; blurb: string }[]`; `EXPERIENCE_COOKIE: string`; `DEFAULT_EXPERIENCE: Experience`; `resolveExperience(value: string | null | undefined): Experience`; `allowsTheme(e: Experience): boolean`; `serializeExperienceCookie(e: Experience): string`.

- [ ] **Step 1: Write the failing test**

Create `lib/experience.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/experience.test.ts`
Expected: FAIL — `Cannot find module './experience'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/experience.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/experience.test.ts`
Expected: PASS (4 describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add lib/experience.ts lib/experience.test.ts
git commit -m "feat: experience mode model (fancy/functional/minimal)"
```

---

### Task 2: Server cookie read + layout wiring

**Files:**
- Create: `lib/experience.server.ts`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `resolveExperience`, `EXPERIENCE_COOKIE` from `lib/experience.ts`.
- Produces: `async getExperience(): Promise<Experience>` (reads the request cookie). After this task, `<html>` carries `data-experience="<mode>"`, and the grain overlay renders only in Fancy.

`getExperience()` reads request cookies, which only works inside a request scope, so it is verified by running the app (below), not by a unit test.

- [ ] **Step 1: Create the server reader**

Create `lib/experience.server.ts`:

```ts
import { cookies } from "next/headers";
import { resolveExperience, EXPERIENCE_COOKIE, type Experience } from "./experience";

export async function getExperience(): Promise<Experience> {
  const store = await cookies();
  return resolveExperience(store.get(EXPERIENCE_COOKIE)?.value);
}
```

- [ ] **Step 2: Wire the attribute into the layout**

In `app/layout.tsx`: add the import, make `RootLayout` async, read the experience, set the attribute, and render the grain overlay only in Fancy.

Add after the existing imports (line 5 area):

```ts
import { getExperience } from "@/lib/experience.server";
```

Replace the component (lines 37-56) with:

```tsx
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const experience = await getExperience();
  return (
    <html
      lang="en"
      data-theme="dark"
      data-experience={experience}
      className={`${fraunces.variable} ${hanken.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        {experience === "fancy" && <div className="grain-overlay" aria-hidden />}
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean (no output / exit 0).

- [ ] **Step 4: Verify the attribute renders (dev server)**

Run (in one shell): `npm run db:up && npm run dev` — wait for "Ready".
Then: `curl -s localhost:3000/ | grep -o 'data-experience="[a-z]*"' | head -1`
Expected: `data-experience="fancy"`.
Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add lib/experience.server.ts app/layout.tsx
git commit -m "feat: resolve experience from cookie and set data-experience on html"
```

---

### Task 3: Experience switcher in header (desktop + mobile), hide theme toggle in Minimal

**Files:**
- Create: `app/_components/experience-switcher.tsx`
- Modify: `app/_components/site-header.tsx`
- Modify: `app/_components/mobile-nav.tsx`

**Interfaces:**
- Consumes: `EXPERIENCES`, `serializeExperienceCookie`, `allowsTheme`, `type Experience` from `lib/experience.ts`; `getExperience` from `lib/experience.server.ts`.
- Produces: `<ExperienceSwitcher current={Experience} />` client component that writes the cookie and calls `router.refresh()`.

The switcher is interactive; its pure piece (`serializeExperienceCookie`) is already tested. This task is verified by running the app.

- [ ] **Step 1: Create the switcher**

Create `app/_components/experience-switcher.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { EXPERIENCES, serializeExperienceCookie, type Experience } from "@/lib/experience";
import { clsx } from "./clsx";

export function ExperienceSwitcher({ current }: { current: Experience }) {
  const router = useRouter();
  function choose(next: Experience) {
    if (next === current) return;
    document.cookie = serializeExperienceCookie(next);
    router.refresh();
  }
  return (
    <div role="group" aria-label="Experience mode" className="flex items-center rounded-full border border-line p-0.5">
      {EXPERIENCES.map((e) => (
        <button
          key={e.key}
          type="button"
          onClick={() => choose(e.key)}
          aria-pressed={current === e.key}
          title={e.blurb}
          className={clsx(
            "rounded-full px-2.5 py-1 font-mono text-[0.66rem] uppercase tracking-wider transition",
            current === e.key ? "bg-gold/15 text-gold" : "text-faint hover:text-ink",
          )}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add it to the desktop header and gate the theme toggle**

In `app/_components/site-header.tsx`: import the switcher + the server reader + `allowsTheme`, make `SiteHeader` async, and render them. Replace the file with:

```tsx
import Link from "next/link";
import { Container } from "./container";
import { SearchBox } from "./search-box";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";
import { ExperienceSwitcher } from "./experience-switcher";
import { Feather } from "./marks";
import { getExperience } from "@/lib/experience.server";
import { allowsTheme } from "@/lib/experience";

const NAV = [
  { href: "/shows", label: "Shows" },
  { href: "/on-this-day", label: "On This Day" },
  { href: "/venues", label: "Venues" },
  { href: "/tours", label: "Tours" },
];

export async function SiteHeader() {
  const experience = await getExperience();
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-2.5 shrink-0">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-line text-gold transition group-hover:border-gold group-hover:rotate-[8deg]">
            <Feather className="h-[18px] w-[18px]" />
          </span>
          <span className="font-display text-[1.15rem] leading-none tracking-tight">
            Goose <span className="italic text-gold">Almanac</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-[0.9rem] text-muted md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="relative py-1 transition hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ExperienceSwitcher current={experience} />
          </div>
          <SearchBox />
          {allowsTheme(experience) && <ThemeToggle />}
          <MobileNav experience={experience} />
        </div>
      </Container>
    </header>
  );
}
```

- [ ] **Step 3: Add it to the mobile menu**

In `app/_components/mobile-nav.tsx`: accept an `experience` prop and render the switcher inside the open menu. Change the signature and the menu body.

Change the import line (after line 6) to add:

```tsx
import { ExperienceSwitcher } from "./experience-switcher";
import type { Experience } from "@/lib/experience";
```

Change `export function MobileNav() {` to:

```tsx
export function MobileNav({ experience }: { experience: Experience }) {
```

Inside the open panel, directly after the `<form>…</form>` search block (before the `<nav>`), insert:

```tsx
<div>
  <span className="mb-2 block font-mono text-[0.62rem] uppercase tracking-wider text-faint">Experience</span>
  <ExperienceSwitcher current={experience} />
</div>
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Verify switching works (dev server + preview)**

Start dev (`npm run dev`). In the preview/browser:
- Click `Functional` in the header switcher → `curl -s --cookie "ga_experience=functional" localhost:3000/ | grep -o 'data-experience="[a-z]*"' | head -1` returns `data-experience="functional"`.
- `curl -s --cookie "ga_experience=minimal" localhost:3000/ | grep -c 'aria-label="Switch to'` returns `0` (theme toggle hidden in Minimal).
Stop dev when done.

- [ ] **Step 6: Commit**

```bash
git add app/_components/experience-switcher.tsx app/_components/site-header.tsx app/_components/mobile-nav.tsx
git commit -m "feat: experience switcher in header and mobile nav; hide theme toggle in minimal"
```

---

### Task 4: Global CSS for Functional and Minimal modes

**Files:**
- Modify: `app/globals.css` (append a new section at the end)

**Interfaces:**
- Consumes: the `data-experience` attribute set in Task 2.
- Produces: Functional uses a sans display font and drops texture/motion; Minimal pivots to a flat high-contrast light palette, neutralizes the gold accent, and drops texture/motion — across every page automatically.

CSS is verified visually (Step 2), not by a unit test.

- [ ] **Step 1: Append the experience layers**

Append to the very end of `app/globals.css` (after the scrollbar block). Placement at the end matters: these attribute selectors must win over the earlier `[data-theme]` blocks.

```css
/* ============================================================
   Experience modes — pivot the same tokens three ways.
   ============================================================ */

/* Functional — utilitarian: sans headers, no texture or motion. */
:root[data-experience="functional"] {
  --font-display: var(--font-body);
}

/* Minimal — flat, high-contrast, single look (ignores data-theme). */
:root[data-experience="minimal"] {
  --bg: #ffffff;
  --bg-deep: #ffffff;
  --surface: #ffffff;
  --surface-2: #f6f6f4;
  --ink: #141414;
  --muted: #4a4a4a;
  --faint: #6a6a6a;
  --line: #e3e3e0;
  --line-soft: #ededea;
  --gold: #141414;
  --gold-soft: #141414;
  --gold-deep: #141414;
  --sage: #1c5f4a;
  --sage-deep: #164d3c;
  --ember: #141414;
  --shadow: rgba(0, 0, 0, 0.12);
  --font-display: var(--font-body);
  color-scheme: light;
}

/* Drop atmosphere + entrance motion outside Fancy. */
[data-experience="functional"] .stage-glow,
[data-experience="minimal"] .stage-glow {
  display: none;
}
[data-experience="functional"] .rise,
[data-experience="minimal"] .rise,
[data-experience="functional"] .fade-in,
[data-experience="minimal"] .fade-in {
  animation: none;
}
[data-experience="minimal"] .eyebrow {
  letter-spacing: 0.12em;
  color: var(--faint);
}
```

- [ ] **Step 2: Verify each mode visually (dev server + preview)**

Start dev. Load `localhost:3000/shows/2022-06-24` three times (set the `ga_experience` cookie to each value via the header switcher or DevTools), confirming:
- Functional: headings render in the sans body font; no grain overlay; hero glow gone.
- Minimal: white background, near-black text, gold accents neutralized to ink; no grain; no glow.
- Fancy: unchanged from today.

Capture a `preview_screenshot` of each for the record. Stop dev when done.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: global CSS pivots for functional and minimal experiences"
```

---

### Task 5: Extract shared setlist logic

**Files:**
- Create: `app/_components/setlist/shared.ts`
- Create: `app/_components/setlist/shared.test.ts`
- Modify: `app/_components/setlist.tsx` (temporarily import from shared; replaced in Task 9)

**Interfaces:**
- Produces: `type SetGroup = { key: string; label: string; entries: SetlistEntry[] }`; `setLabel(type: string | null, num: string | null): string`; `isSegue(t: string | null): boolean`; `groupSets(entries: SetlistEntry[]): SetGroup[]`.
- These are pure; `SetlistEntry` is imported as a type only (erased at runtime), so the test needs no path alias.

- [ ] **Step 1: Write the failing test**

Create `app/_components/setlist/shared.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupSets, setLabel, isSegue, type SetGroup } from "./shared";
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_components/setlist/shared.test.ts`
Expected: FAIL — `Cannot find module './shared'`.

- [ ] **Step 3: Create the shared module**

Create `app/_components/setlist/shared.ts` (logic lifted verbatim from the current `setlist.tsx`):

```ts
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
```

- [ ] **Step 4: Point the existing component at the shared module (no behavior change)**

In `app/_components/setlist.tsx`, delete the local `ROMAN`, `setLabel`, `isSegue`, `Group`, and `groupSets` definitions (lines 6-36) and add this import after line 4:

```ts
import { groupSets, isSegue } from "./setlist/shared";
```

(The component body still calls `groupSets(entries)` and `isSegue(...)` exactly as before.)

- [ ] **Step 5: Run tests to verify everything passes**

Run: `npx vitest run app/_components/setlist/shared.test.ts && npm run typecheck`
Expected: PASS + clean typecheck.

- [ ] **Step 6: Commit**

```bash
git add app/_components/setlist/shared.ts app/_components/setlist/shared.test.ts app/_components/setlist.tsx
git commit -m "refactor: extract shared setlist grouping logic"
```

---

### Task 6: SetlistFancy variant + component-render test harness

**Files:**
- Modify: `vitest.config.ts` (enable component rendering)
- Create: `app/_components/setlist/fancy.tsx`
- Create: `app/_components/setlist/fancy.test.tsx`

**Interfaces:**
- Consumes: `groupSets`, `isSegue` from `./shared`.
- Produces: `SetlistFancy({ entries }: { entries: SetlistEntry[] })` — today's threaded, flame-marked setlist markup.

- [ ] **Step 1: Enable JSX + the `@` alias in Vitest**

Replace `vitest.config.ts` with:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
  },
});
```

- [ ] **Step 2: Write the failing render test**

Create `app/_components/setlist/fancy.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SetlistFancy } from "./fancy";
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

describe("SetlistFancy", () => {
  it("renders an ordered list with song names and a jam flame", () => {
    const html = renderToStaticMarkup(
      <SetlistFancy entries={[entry({ song: "Madhuvan", isJamchart: true, jamchartNotes: "huge" })]} />,
    );
    expect(html).toContain("<ol");
    expect(html).toContain("Madhuvan");
    expect(html).toContain("<svg"); // the flame mark
  });
  it("renders an empty-state when there are no entries", () => {
    const html = renderToStaticMarkup(<SetlistFancy entries={[]} />);
    expect(html).toContain("No setlist");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run app/_components/setlist/fancy.test.tsx`
Expected: FAIL — `Cannot find module './fancy'`.

- [ ] **Step 4: Create the Fancy variant**

Create `app/_components/setlist/fancy.tsx` (the current setlist body, now sourced from `./shared`):

```tsx
import { Flame } from "../marks";
import { clsx } from "../clsx";
import { trackSeconds, formatDuration } from "@/lib/queries/format";
import type { SetlistEntry } from "@/lib/queries/shows";
import { groupSets, isSegue } from "./shared";

export function SetlistFancy({ entries }: { entries: SetlistEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface/50 px-5 py-8 text-center text-muted">
        No setlist has been recorded for this show yet.
      </p>
    );
  }
  const groups = groupSets(entries);

  return (
    <div className="space-y-10">
      {groups.map((g) => {
        const secs = g.entries.map((e) => trackSeconds(e.trackTime)).filter((s): s is number => s != null);
        const total = secs.length >= Math.ceil(g.entries.length / 2) ? secs.reduce((a, b) => a + b, 0) : null;

        return (
          <section key={g.key}>
            <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-line pb-2">
              <h3 className="font-display text-xl text-ink">{g.label}</h3>
              <span className="font-mono text-[0.7rem] text-faint">
                {g.entries.length} {g.entries.length === 1 ? "song" : "songs"}
                {total ? ` · ${formatDuration(total)}` : ""}
              </span>
            </div>

            <ol>
              {g.entries.map((e, i) => {
                const prev = g.entries[i - 1];
                const segFromPrev = prev ? isSegue(prev.transition) : false;
                const segToNext = isSegue(e.transition);
                const inRun = segFromPrev || segToNext;
                const thread =
                  segFromPrev && segToNext
                    ? "before:top-0 before:h-full"
                    : segFromPrev
                      ? "before:top-0 before:h-1/2"
                      : "before:top-1/2 before:h-1/2";

                return (
                  <li
                    key={e.uniqueId}
                    className={clsx(
                      "group relative flex items-baseline gap-3 py-[7px] pl-4",
                      inRun &&
                        "before:absolute before:left-[1px] before:w-[2px] before:rounded-full before:bg-gold/45",
                      inRun && thread,
                    )}
                  >
                    <span className="w-5 shrink-0 text-right font-mono text-[0.7rem] tabular-nums text-faint">
                      {i + 1}
                    </span>
                    <span className="flex-1 leading-snug">
                      {segFromPrev && <span className="mr-1 select-none text-gold">›</span>}
                      <span className="text-[1.02rem] text-ink">{e.song}</span>
                      {e.isJamchart && (
                        <span title={e.jamchartNotes ?? "Jam chart"}>
                          <Flame className="ml-1.5 inline h-[15px] w-[15px] -translate-y-px text-gold" strokeWidth={1.7} />
                        </span>
                      )}
                      {!e.isOriginal && e.originalArtist && (
                        <span className="ml-2 align-baseline text-xs italic text-faint">{e.originalArtist}</span>
                      )}
                      {e.footnote && (
                        <span className="ml-1 cursor-help align-super text-[0.6rem] text-sage" title={e.footnote}>
                          °
                        </span>
                      )}
                    </span>
                    {e.trackTime && (
                      <span className="shrink-0 font-mono text-[0.72rem] tabular-nums text-muted">{e.trackTime}</span>
                    )}
                  </li>
                );
              })}
            </ol>

            {g.entries.some((e) => e.isJamchart && e.jamchartNotes) && (
              <ul className="mt-4 space-y-2 border-t border-line-soft pt-3">
                {g.entries
                  .filter((e) => e.isJamchart && e.jamchartNotes)
                  .map((e) => (
                    <li key={e.uniqueId} className="flex gap-2.5 text-[0.82rem] leading-relaxed text-muted">
                      <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={1.7} />
                      <span>
                        <span className="text-ink">{e.song}</span> — {e.jamchartNotes}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/_components/setlist/fancy.test.tsx`
Expected: PASS (both cases). If it errors on JSX/`React is not defined`, confirm `esbuild: { jsx: "automatic" }` is set in `vitest.config.ts`.

- [ ] **Step 6: Confirm the whole suite still passes**

Run: `npm test`
Expected: all tests pass (the new alias/jsx config must not break the existing node tests).

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts app/_components/setlist/fancy.tsx app/_components/setlist/fancy.test.tsx
git commit -m "feat: SetlistFancy variant + component render-test harness"
```

---

### Task 7: SetlistFunctional variant (dense table)

**Files:**
- Create: `app/_components/setlist/functional.tsx`
- Create: `app/_components/setlist/functional.test.tsx`

**Interfaces:**
- Consumes: `groupSets`, `isSegue` from `./shared`; `Flame` from `../marks`.
- Produces: `SetlistFunctional({ entries }: { entries: SetlistEntry[] })` — a single dense `<table>` with columns Set · # · Song · → · Time · Jam.

- [ ] **Step 1: Write the failing render test**

Create `app/_components/setlist/functional.test.tsx`:

```tsx
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
    originalArtist: null, footnote: null, ...p,
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_components/setlist/functional.test.tsx`
Expected: FAIL — `Cannot find module './functional'`.

- [ ] **Step 3: Create the Functional variant**

Create `app/_components/setlist/functional.tsx`:

```tsx
import { Flame } from "../marks";
import { groupSets, isSegue } from "./shared";
import type { SetlistEntry } from "@/lib/queries/shows";

export function SetlistFunctional({ entries }: { entries: SetlistEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted">No setlist has been recorded for this show yet.</p>;
  }
  const groups = groupSets(entries);
  return (
    <table className="w-full border-collapse font-mono text-sm">
      <thead>
        <tr className="border-b border-line text-left text-[0.66rem] uppercase tracking-wider text-faint">
          <th className="py-2 pr-3 font-normal">Set</th>
          <th className="py-2 pr-3 font-normal">#</th>
          <th className="w-full py-2 pr-3 font-normal">Song</th>
          <th className="py-2 pr-3 font-normal" aria-label="Segue">→</th>
          <th className="py-2 pr-3 text-right font-normal">Time</th>
          <th className="py-2 font-normal">Jam</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) =>
          g.entries.map((e, i) => (
            <tr key={e.uniqueId} className="border-b border-line-soft align-baseline">
              <td className="py-1.5 pr-3 text-faint">{i === 0 ? g.label : ""}</td>
              <td className="py-1.5 pr-3 tabular-nums text-faint">{i + 1}</td>
              <td className="py-1.5 pr-3 text-ink">{e.song}</td>
              <td className="py-1.5 pr-3 text-gold">{isSegue(e.transition) ? "›" : ""}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-muted">{e.trackTime ?? "—"}</td>
              <td className="py-1.5">
                {e.isJamchart ? (
                  <Flame className="inline h-3.5 w-3.5 text-gold" strokeWidth={1.7} />
                ) : (
                  <span className="text-faint">·</span>
                )}
              </td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_components/setlist/functional.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/_components/setlist/functional.tsx app/_components/setlist/functional.test.tsx
git commit -m "feat: SetlistFunctional dense-table variant"
```

---

### Task 8: SetlistMinimal variant (plain semantic)

**Files:**
- Create: `app/_components/setlist/minimal.tsx`
- Create: `app/_components/setlist/minimal.test.tsx`

**Interfaces:**
- Consumes: `groupSets`, `isSegue` from `./shared`.
- Produces: `SetlistMinimal({ entries }: { entries: SetlistEntry[] })` — semantic `<h3>` + `<ol>`/`<li>`, inline ` > ` segues, `· jam`, `(time)`. No decorative markup.

- [ ] **Step 1: Write the failing render test**

Create `app/_components/setlist/minimal.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_components/setlist/minimal.test.tsx`
Expected: FAIL — `Cannot find module './minimal'`.

- [ ] **Step 3: Create the Minimal variant**

Create `app/_components/setlist/minimal.tsx`:

```tsx
import { groupSets, isSegue } from "./shared";
import type { SetlistEntry } from "@/lib/queries/shows";

export function SetlistMinimal({ entries }: { entries: SetlistEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted">No setlist has been recorded for this show yet.</p>;
  }
  const groups = groupSets(entries);
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="mb-1 font-display text-lg text-ink">{g.label}</h3>
          <ol className="list-decimal space-y-0.5 pl-6 text-ink">
            {g.entries.map((e) => (
              <li key={e.uniqueId}>
                {e.song}
                {!e.isOriginal && e.originalArtist ? ` (${e.originalArtist})` : ""}
                {isSegue(e.transition) ? " > " : ""}
                {e.isJamchart ? " · jam" : ""}
                {e.trackTime ? ` (${e.trackTime})` : ""}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_components/setlist/minimal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/_components/setlist/minimal.tsx app/_components/setlist/minimal.test.tsx
git commit -m "feat: SetlistMinimal plain-semantic variant"
```

---

### Task 9: Setlist selector + show-page integration

**Files:**
- Create: `app/_components/setlist/index.tsx`
- Delete: `app/_components/setlist.tsx`
- Modify: `app/shows/[date]/page.tsx`

**Interfaces:**
- Consumes: `SetlistFancy`, `SetlistFunctional`, `SetlistMinimal`; `type Experience`.
- Produces: `Setlist({ entries, experience }: { entries: SetlistEntry[]; experience: Experience })`. The import path `@/app/_components/setlist` now resolves to the new folder's `index.tsx`.

- [ ] **Step 1: Create the selector**

Create `app/_components/setlist/index.tsx`:

```tsx
import type { SetlistEntry } from "@/lib/queries/shows";
import type { Experience } from "@/lib/experience";
import { SetlistFancy } from "./fancy";
import { SetlistFunctional } from "./functional";
import { SetlistMinimal } from "./minimal";

export function Setlist({
  entries,
  experience,
}: {
  entries: SetlistEntry[];
  experience: Experience;
}) {
  if (experience === "functional") return <SetlistFunctional entries={entries} />;
  if (experience === "minimal") return <SetlistMinimal entries={entries} />;
  return <SetlistFancy entries={entries} />;
}
```

- [ ] **Step 2: Delete the old single-file component**

```bash
git rm app/_components/setlist.tsx
```

(Its grouping logic now lives in `setlist/shared.ts` and its markup in `setlist/fancy.tsx`.)

- [ ] **Step 3: Pass the experience from the show page**

In `app/shows/[date]/page.tsx`:

Add to the imports (after line 7):

```ts
import { getExperience } from "@/lib/experience.server";
```

In `ShowPage`, after the `const [setlist, neighbors] = await Promise.all([...])` block (line 58), add:

```ts
const experience = await getExperience();
```

Replace `<Setlist entries={setlist} />` (line 190) with:

```tsx
<Setlist entries={setlist} experience={experience} />
```

- [ ] **Step 4: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: clean typecheck; all tests pass.

- [ ] **Step 5: Verify all three render on the live page (dev server)**

Start dev. For each mode, set the cookie and confirm the setlist markup differs:
- `curl -s --cookie "ga_experience=functional" localhost:3000/shows/2022-06-24 | grep -c "<table"` → `1` or more.
- `curl -s --cookie "ga_experience=minimal" localhost:3000/shows/2022-06-24 | grep -c "<svg"` → fewer flames than Fancy (no setlist flames).
- `curl -s --cookie "ga_experience=fancy" localhost:3000/shows/2022-06-24 | grep -c "before:bg-gold/45"` → present (segue threads).
Stop dev when done.

- [ ] **Step 6: Commit**

```bash
git add app/_components/setlist/index.tsx app/shows/[date]/page.tsx
git commit -m "feat: select setlist variant by experience on the show page"
```

---

### Task 10: JSON-LD structured data

**Files:**
- Create: `lib/jsonld.ts`
- Create: `lib/jsonld.test.ts`
- Create: `app/_components/json-ld.tsx`
- Modify: `app/layout.tsx` (site-level JSON-LD)
- Modify: `app/shows/[date]/page.tsx` (MusicEvent + Minimal `<details>`)

**Interfaces:**
- Consumes: `ShowDetail`, `SetlistEntry` (types) and `locationLine` from the query/format layer.
- Produces: `showJsonLd(show: ShowDetail, setlist: SetlistEntry[]): object`; `siteJsonLd(): object`; `<JsonLd data={object} />`.

- [ ] **Step 1: Write the failing builder test**

Create `lib/jsonld.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { showJsonLd, siteJsonLd } from "./jsonld";
import type { ShowDetail, SetlistEntry } from "@/lib/queries/shows";

const show: ShowDetail = {
  showId: 1, date: "2025-06-28", order: null, venue: "Madison Square Garden",
  city: "New York", state: "NY", country: "USA", tour: null, tourId: null,
  songCount: 2, hasNotes: false, venueId: 9, permalink: null, notes: null,
};
const setlist = [
  { song: "Madhuvan" }, { song: "Hot Tea" },
] as SetlistEntry[];

describe("showJsonLd", () => {
  it("builds a MusicEvent with venue, performer, and ordered songs", () => {
    const ld = showJsonLd(show, setlist) as Record<string, unknown>;
    expect(ld["@type"]).toBe("MusicEvent");
    expect(ld.startDate).toBe("2025-06-28");
    expect((ld.name as string)).toContain("Madison Square Garden");
    expect((ld.performer as Record<string, unknown>).name).toBe("Goose");
    const works = ld.workPerformed as { name: string }[];
    expect(works.map((w) => w.name)).toEqual(["Madhuvan", "Hot Tea"]);
  });
});

describe("siteJsonLd", () => {
  it("describes the site as a WebSite about Goose", () => {
    const ld = siteJsonLd() as Record<string, unknown>;
    expect(ld["@type"]).toBe("WebSite");
    expect((ld.about as Record<string, unknown>).name).toBe("Goose");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/jsonld.test.ts`
Expected: FAIL — `Cannot find module './jsonld'`.

- [ ] **Step 3: Create the builders**

Create `lib/jsonld.ts`:

```ts
import type { ShowDetail, SetlistEntry } from "@/lib/queries/shows";
import { locationLine } from "@/lib/queries/format";

export function showJsonLd(show: ShowDetail, setlist: SetlistEntry[]): object {
  const address = locationLine(show.city, show.state, show.country);
  return {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: `Goose at ${show.venue ?? "an unknown venue"}`,
    startDate: show.date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(show.venue
      ? {
          location: {
            "@type": "MusicVenue",
            name: show.venue,
            ...(address ? { address } : {}),
          },
        }
      : {}),
    performer: { "@type": "MusicGroup", name: "Goose" },
    workPerformed: setlist.map((e) => ({ "@type": "MusicComposition", name: e.song })),
  };
}

export function siteJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Goose Almanac",
    description: "An almanac of every Goose show: setlists, venues, tours, and stats.",
    about: { "@type": "MusicGroup", name: "Goose" },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/jsonld.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the JsonLd component**

Create `app/_components/json-ld.tsx`:

```tsx
export function JsonLd({ data }: { data: object }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
```

- [ ] **Step 6: Render site JSON-LD in the layout**

In `app/layout.tsx`, add the imports:

```ts
import { JsonLd } from "./_components/json-ld";
import { siteJsonLd } from "@/lib/jsonld";
```

Inside `<head>`, after the theme `<script>`, add:

```tsx
<JsonLd data={siteJsonLd()} />
```

- [ ] **Step 7: Render MusicEvent + Minimal disclosure on the show page**

In `app/shows/[date]/page.tsx`, add imports:

```ts
import { JsonLd } from "@/app/_components/json-ld";
import { showJsonLd } from "@/lib/jsonld";
```

Compute the structured data after `const experience = await getExperience();`:

```ts
const ld = showJsonLd(show, setlist);
```

Render the hidden script as the first child inside `<article>` (right after the opening tag, line 72):

```tsx
<JsonLd data={ld} />
```

In the body `<Container size="prose" …>`, immediately after `<Setlist entries={setlist} experience={experience} />`, add the Minimal-only human disclosure:

```tsx
{experience === "minimal" && (
  <details className="mt-10 border-t border-line pt-4 text-sm">
    <summary className="cursor-pointer text-muted">Structured data (schema.org MusicEvent)</summary>
    <pre className="mt-3 overflow-auto rounded border border-line bg-surface p-3 font-mono text-xs text-muted">
      {JSON.stringify(ld, null, 2)}
    </pre>
  </details>
)}
```

- [ ] **Step 8: Typecheck + full suite + verify in page**

Run: `npm run typecheck && npm test`
Expected: clean + all pass.
Then start dev and check: `curl -s localhost:3000/shows/2022-06-24 | grep -c 'application/ld+json'` → `2` (site + show). Stop dev.

- [ ] **Step 9: Commit**

```bash
git add lib/jsonld.ts lib/jsonld.test.ts app/_components/json-ld.tsx app/layout.tsx app/shows/[date]/page.tsx
git commit -m "feat: schema.org JSON-LD (site WebSite + show MusicEvent), surfaced in minimal"
```

---

### Task 11: Shows-browse list variant (Minimal plain list)

**Files:**
- Create: `app/_components/show-list.tsx`
- Create: `app/_components/show-list.test.tsx`
- Modify: `app/shows/page.tsx`

**Interfaces:**
- Consumes: `ShowRow` from `./show-card`; `showHref`, `locationLine` from format; `type ShowSummary`, `type Experience`.
- Produces: `ShowList({ rows, experience }: { rows: ShowSummary[]; experience: Experience })`. Fancy and Functional share the existing dense ledger (`ShowRow`); Minimal renders a plain semantic `<ul>` of links. (A bespoke Functional table for the browse list is a deferred follow-up — see spec "Scope".)

- [ ] **Step 1: Write the failing render test**

Create `app/_components/show-list.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShowList } from "./show-list";
import type { ShowSummary } from "@/lib/queries/shows";

const rows: ShowSummary[] = [
  { showId: 1, date: "2025-06-28", order: null, venue: "MSG", city: "New York", state: "NY", country: "USA", tour: null, tourId: null, songCount: 12, hasNotes: false },
];

describe("ShowList", () => {
  it("minimal renders a plain list with a date-and-venue link", () => {
    const html = renderToStaticMarkup(<ShowList rows={rows} experience="minimal" />);
    expect(html).toContain("<ul");
    expect(html).toContain("2025-06-28");
    expect(html).toContain("MSG");
    expect(html).not.toContain("surface-card"); // not the ledger card
  });
  it("fancy renders the ledger card list", () => {
    const html = renderToStaticMarkup(<ShowList rows={rows} experience="fancy" />);
    expect(html).toContain("surface-card");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/_components/show-list.test.tsx`
Expected: FAIL — `Cannot find module './show-list'`.

- [ ] **Step 3: Create the ShowList component**

Create `app/_components/show-list.tsx`:

```tsx
import Link from "next/link";
import { ShowRow } from "./show-card";
import { showHref, locationLine } from "@/lib/queries/format";
import type { ShowSummary } from "@/lib/queries/shows";
import type { Experience } from "@/lib/experience";

export function ShowList({ rows, experience }: { rows: ShowSummary[]; experience: Experience }) {
  if (experience === "minimal") {
    return (
      <ul className="list-disc space-y-1 pl-6 text-ink">
        {rows.map((s) => {
          const loc = locationLine(s.city, s.state, s.country);
          return (
            <li key={s.showId}>
              <Link href={showHref(s.date, s.order)} className="underline">
                {s.date} — {s.venue ?? "Unknown venue"}
                {loc ? `, ${loc}` : ""}
              </Link>
              {s.songCount > 0 ? ` (${s.songCount} songs)` : ""}
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className="surface-card divide-y divide-line-soft">
      {rows.map((s) => (
        <li key={s.showId}>
          <ShowRow show={s} />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/_components/show-list.test.tsx`
Expected: PASS.

- [ ] **Step 5: Use it on the browse page**

In `app/shows/page.tsx`:

Replace the import of `ShowRow` (line 4) with:

```ts
import { ShowList } from "@/app/_components/show-list";
```

Add the experience import (after line 8):

```ts
import { getExperience } from "@/lib/experience.server";
```

After `const totalPages = ...` (line 41), add:

```ts
const experience = await getExperience();
```

Replace the non-empty branch of the show-list block (lines 140-147, the `<ul className="surface-card …">…</ul>`) with:

```tsx
<ShowList rows={rows} experience={experience} />
```

- [ ] **Step 6: Typecheck + full suite + verify**

Run: `npm run typecheck && npm test`
Expected: clean + all pass.
Start dev: `curl -s --cookie "ga_experience=minimal" localhost:3000/shows | grep -c "surface-card"` → `0` in the list area (plain list). Stop dev.

- [ ] **Step 7: Commit**

```bash
git add app/_components/show-list.tsx app/_components/show-list.test.tsx app/shows/page.tsx
git commit -m "feat: minimal plain-list variant for the shows browse page"
```

---

### Task 12: Full verification + ship

**Files:**
- Modify: `README.md` (note the feature)
- Modify: `docs/superpowers/specs/2026-06-27-experience-modes-design.md` (mark built)

- [ ] **Step 1: Whole suite, types, production build**

Stop any running dev server first. Then:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all tests pass; typecheck clean; build succeeds with the route list printed.

- [ ] **Step 2: Visual proof of all three modes**

Start dev. Capture `preview_screenshot` of `/shows/2022-06-24` and `/shows` in each of Fancy, Functional, Minimal (switch via the header control). Confirm: distinct typography/density per mode; light/dark toggle present in Fancy/Functional and absent in Minimal; Minimal shows the JSON-LD `<details>`. Stop dev.

- [ ] **Step 3: Note the feature**

In `README.md`, under the roadmap table, add a line noting experience modes are live (Fancy/Functional/Minimal). In the spec file header, change `Status: approved` to `Status: built 2026-06-27`.

- [ ] **Step 4: Commit + push (auto-deploys via Vercel)**

```bash
git add README.md docs/superpowers/specs/2026-06-27-experience-modes-design.md
git commit -m "docs: note experience modes shipped"
git push origin main
```

- [ ] **Step 5: Verify on production**

After the Vercel deploy goes green:

```bash
U="goose-almanac-git-main-tims-projects-0609e619.vercel.app"
curl -s --cookie "ga_experience=functional" "https://$U/shows/2022-06-24" | grep -o 'data-experience="[a-z]*"' | head -1
curl -s "https://$U/shows/2022-06-24" | grep -c 'application/ld+json'
```

Expected: `data-experience="functional"`; JSON-LD count `2`.

---

## Self-Review

**Spec coverage:**
- Three modes (Fancy/Functional/Minimal) → Tasks 6, 7, 8 (setlist) + Task 4 (global CSS) + Task 11 (shows list). ✓
- Default Fancy → Task 1 `DEFAULT_EXPERIENCE`. ✓
- Per-visitor persistence via cookie, server-resolved, no flash → Tasks 1, 2. ✓
- Switcher in header beside theme toggle; theme hidden in Minimal → Task 3. ✓
- Light/dark orthogonal → Task 4 (Minimal forces its own palette; Fancy/Functional keep `data-theme`). ✓
- JSON-LD in every mode + Minimal disclosure → Task 10. ✓
- `data-experience` on `<html>` → Task 2. ✓
- Testing: resolution, builders, per-mode render → Tasks 1, 5, 6, 7, 8, 10, 11. ✓
- Deferred items (bespoke Functional browse table; other listings' bespoke variants) → called out in Task 11 and spec Scope; global CSS (Task 4) covers their chrome. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command has expected output.

**Type consistency:** `Experience`, `EXPERIENCE_COOKIE`, `resolveExperience`, `getExperience`, `serializeExperienceCookie`, `allowsTheme`, `SetGroup`, `groupSets`, `isSegue`, `Setlist({entries, experience})`, `ShowList({rows, experience})`, `showJsonLd`, `siteJsonLd`, `JsonLd` are defined once and consumed with matching signatures across tasks. The `@/app/_components/setlist` import path resolves to the new `setlist/index.tsx` after Task 9 deletes the old file.
