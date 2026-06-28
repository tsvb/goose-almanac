# Minimal Early-Web Document — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Minimal experience a meticulously organized early-web HTML document on **every page** — system serif, semantic data tables, footnotes, hairline rules, classic links — built from reusable doc primitives.

**Architecture:** Minimal-only document primitives in `app/_components/doc.tsx`, styled by a `[data-experience="minimal"]` CSS block. Each page reads `getExperience()` and, when minimal, returns a document body built from the primitives using the data it already fetches; fancy/functional bodies are unchanged.

**Tech Stack:** Next.js 15 (server components), Tailwind v4 (the minimal doc uses plain CSS classes, not utilities), Vitest + `react-dom/server`.

## Global Constraints

- Minimal = `[data-experience="minimal"]`. Only the Minimal branch changes on each page; Fancy and Functional bodies stay exactly as they are.
- `getExperience()` (from `@/lib/experience.server`) resolves the mode server-side; pages are async server components.
- Doc primitives use plain class names (`doc`, `doc-crumb`, `doc-meta`, `doc-table`, `doc-h2`, `doc-foot`, `nowrap`, `num`) defined in `app/globals.css` under `[data-experience="minimal"]` — NOT Tailwind utilities.
- No webfonts in Minimal: serif is `Georgia, "Times New Roman", serif`; figures use `ui-monospace`.
- Data types (verbatim): `ShowSummary { showId, date, order, venue, city, state, country, tour, tourId, songCount, hasNotes }`; `VenueRow { venueId, name, city, state, country, capacity, shows, first, last }`; `TourRow { tourId, name, year, shows, start, end }`; `YearRow { year, shows, songs }`; `OverviewStats { showsPlayed, upcoming, songs, venues, performances, firstDate, lastPlayedDate }`.
- format helpers (from `@/lib/queries/format`): `showHref(date, order?)`, `locationLine(city,state,country)`, `formatShortDate(date)`, `formatMonthDay(date)`, `dateParts(date)`, `compact(n)`.
- `npm test`, `npm run typecheck`, `npm run build` must pass. Never `npm run build` while `npm run dev` runs.

---

### Task 1: Minimal serif + document CSS

**Files:** Modify `app/globals.css`.

CSS only — verified by compiled output + later visual pass.

- [ ] **Step 1: Switch the Minimal type to serif**

In the `:root[data-experience="minimal"]` block, change the three `--type-*` lines to:

```css
  --type-display: Georgia, "Times New Roman", serif;
  --type-body: Georgia, "Times New Roman", serif;
  --type-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```

- [ ] **Step 2: Append the document styles**

After the existing `[data-experience="minimal"] a { … }` rule, append:

```css
[data-experience="minimal"] .doc { max-width: 640px; }
[data-experience="minimal"] .doc-crumb { font-size: 0.85rem; color: var(--muted); margin-bottom: 1.1rem; }
[data-experience="minimal"] h1 { font-size: 1.6rem; font-weight: 700; line-height: 1.15; margin: 0 0 0.5rem; }
[data-experience="minimal"] .doc-h2 { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #333; margin: 1.6rem 0 0.45rem; padding-bottom: 3px; border-bottom: 1px solid #cfcfcf; }
[data-experience="minimal"] table.doc-meta { border-collapse: collapse; margin: 0 0 1.4rem; font-size: 0.95rem; }
[data-experience="minimal"] table.doc-meta td { padding: 3px 0; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
[data-experience="minimal"] table.doc-meta td.k { width: 7rem; color: var(--muted); padding-right: 0.9rem; white-space: nowrap; }
[data-experience="minimal"] table.doc-table { border-collapse: collapse; width: 100%; font-size: 0.95rem; margin: 0.2rem 0 1rem; }
[data-experience="minimal"] table.doc-table th { text-align: left; font-weight: 700; border-bottom: 1px solid #cfcfcf; padding: 3px 12px 3px 0; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
[data-experience="minimal"] table.doc-table td { padding: 3px 12px 3px 0; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
[data-experience="minimal"] table.doc-table th.num, [data-experience="minimal"] table.doc-table td.num { text-align: right; font-family: var(--type-mono); font-size: 0.85rem; padding-right: 0; white-space: nowrap; }
[data-experience="minimal"] .nowrap { white-space: nowrap; }
[data-experience="minimal"] .doc sup a { font-size: 0.7rem; }
[data-experience="minimal"] ol.doc-notes { font-size: 0.9rem; color: var(--muted); padding-left: 1.4rem; line-height: 1.55; }
[data-experience="minimal"] .doc-foot { margin-top: 1.8rem; padding-top: 0.6rem; border-top: 1px solid var(--line); font-size: 0.8rem; color: var(--muted); }
```

- [ ] **Step 3: Build + verify**

`npm run build` (no dev server). Then:
`CSS=$(ls -t .next/static/css/*.css | head -1); grep -c 'data-experience=minimal\]{[^}]*--type-display:Georgia' "$CSS"` → `1`; `grep -c 'data-experience=minimal\] table.doc-table' "$CSS"` → ≥1. `npm test` stays green.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: minimal serif + early-web document CSS (tables, hairlines, measure)"
```

---

### Task 2: Document primitives

**Files:** Create `app/_components/doc.tsx`; create `app/_components/doc.test.tsx`.

**Interfaces (Produces):**
- `Doc({ children })` → `<div className="doc">`.
- `Breadcrumb({ trail: { href?: string; label: string }[] })` → `a › a › text`.
- `MetaTable({ rows: { k: string; v: ReactNode }[] })` → 2-col facts table.
- `ShowTable({ shows: ShowSummary[] })` → Date · Venue · Location · Songs, rows link to the show.
- `EntityTable({ rows: { href: string; name: string; sub?: string; count?: ReactNode }[] })`.
- `DocSection({ title: string; children })` → `<h2 className="doc-h2">` + children.
- `Footnotes({ notes: { id: string; text: string }[] })` → `<ol className="doc-notes">`.

- [ ] **Step 1: Write the failing test**

Create `app/_components/doc.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Breadcrumb, MetaTable, ShowTable, EntityTable } from "./doc";
import type { ShowSummary } from "@/lib/queries/shows";

const shows: ShowSummary[] = [
  { showId: 1, date: "2025-06-28", order: null, venue: "MSG", city: "New York", state: "NY", country: "USA", tour: null, tourId: null, songCount: 12, hasNotes: false },
];

describe("doc primitives", () => {
  it("Breadcrumb renders links and a trailing label with separators", () => {
    const html = renderToStaticMarkup(<Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { label: "Shows" }]} />);
    expect(html).toContain("Goose Almanac");
    expect(html).toContain("›");
    expect(html).toContain("Shows");
  });
  it("ShowTable renders a table row linking to the show", () => {
    const html = renderToStaticMarkup(<ShowTable shows={shows} />);
    expect(html).toContain("<table");
    expect(html).toContain("2025-06-28");
    expect(html).toContain("MSG");
    expect(html).toContain("/shows/2025-06-28");
  });
  it("MetaTable renders k/v rows", () => {
    const html = renderToStaticMarkup(<MetaTable rows={[{ k: "Songs", v: 12 }]} />);
    expect(html).toContain("Songs");
    expect(html).toContain("12");
  });
  it("EntityTable links each row", () => {
    const html = renderToStaticMarkup(<EntityTable rows={[{ href: "/venues/9", name: "MSG", count: 5 }]} />);
    expect(html).toContain("/venues/9");
    expect(html).toContain("MSG");
  });
});
```

- [ ] **Step 2: Run test (RED)** — `npx vitest run app/_components/doc.test.tsx` → fails (module missing).

- [ ] **Step 3: Create the primitives**

Create `app/_components/doc.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { showHref, locationLine } from "@/lib/queries/format";
import type { ShowSummary } from "@/lib/queries/shows";

export function Doc({ children }: { children: ReactNode }) {
  return <div className="doc">{children}</div>;
}

export function Breadcrumb({ trail }: { trail: { href?: string; label: string }[] }) {
  return (
    <nav className="doc-crumb">
      {trail.map((t, i) => (
        <span key={i}>
          {i > 0 ? " › " : ""}
          {t.href ? <Link href={t.href}>{t.label}</Link> : <span>{t.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function MetaTable({ rows }: { rows: { k: string; v: ReactNode }[] }) {
  return (
    <table className="doc-meta">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="k">{r.k}</td>
            <td>{r.v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ShowTable({ shows }: { shows: ShowSummary[] }) {
  if (shows.length === 0) return <p>No shows.</p>;
  return (
    <table className="doc-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Venue</th>
          <th>Location</th>
          <th className="num">Songs</th>
        </tr>
      </thead>
      <tbody>
        {shows.map((s) => (
          <tr key={s.showId}>
            <td className="nowrap">
              <Link href={showHref(s.date, s.order)}>{s.date}</Link>
            </td>
            <td>{s.venue ?? "Unknown venue"}</td>
            <td>{locationLine(s.city, s.state, s.country) || "—"}</td>
            <td className="num">{s.songCount > 0 ? s.songCount : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EntityTable({
  rows,
}: {
  rows: { href: string; name: string; sub?: string; count?: ReactNode }[];
}) {
  return (
    <table className="doc-table">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>
              <Link href={r.href}>{r.name}</Link>
              {r.sub ? <span className="sub"> — {r.sub}</span> : null}
            </td>
            <td className="num">{r.count ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="doc-h2">{title}</h2>
      {children}
    </section>
  );
}

export function Footnotes({ notes }: { notes: { id: string; text: string }[] }) {
  if (notes.length === 0) return null;
  return (
    <ol className="doc-notes">
      {notes.map((n) => (
        <li key={n.id} id={n.id}>{n.text}</li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 4: Run test (GREEN)** — `npx vitest run app/_components/doc.test.tsx`, then `npm run typecheck` (clean) and `npm test` (green).

- [ ] **Step 5: Commit**

```bash
git add app/_components/doc.tsx app/_components/doc.test.tsx
git commit -m "feat: minimal document primitives (Breadcrumb, MetaTable, ShowTable, EntityTable, DocSection, Footnotes)"
```

---

### Task 3: Show-detail Minimal document (header + setlist as tables + footnotes)

**Files:**
- Modify: `app/_components/show-header.tsx` (the minimal branch → breadcrumb + h1 + MetaTable)
- Modify: `app/_components/setlist/minimal.tsx` (→ per-set tables + jam footnotes)
- Modify: `app/_components/setlist/minimal.test.tsx` (update assertions)

**Interfaces:** `ShowHeader`/`SetlistMinimal` props unchanged. The minimal show page already renders `<ShowHeader … experience="minimal" />` then `<Setlist entries experience="minimal" />` then the minimal `<details>` JSON-LD and the flattened notes/prev-next (from the prior branch).

- [ ] **Step 1: Rework the minimal ShowHeader branch**

In `app/_components/show-header.tsx`, replace the `if (experience === "minimal") { return ( … ) }` block with a Doc-based document head:

```tsx
if (experience === "minimal") {
  return (
    <Container className="py-8">
      <Doc>
        <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { href: "/shows", label: "Shows" }, { label: date }]} />
        <h1>{show.venue ? `Goose at ${show.venue}` : "Goose"}</h1>
        <p className="doc-crumb">{dp.weekday}, {dp.month} {dp.day}, {dp.year}{loc ? ` · ${loc}` : ""}</p>
        <MetaTable
          rows={[
            { k: "Date", v: `${dp.weekday}, ${dp.month} ${dp.day}, ${dp.year}` },
            ...(show.venue ? [{ k: "Venue", v: show.venueId ? <Link href={`/venues/${show.venueId}`}>{show.venue}</Link> : show.venue }] : []),
            ...(loc ? [{ k: "Location", v: loc }] : []),
            ...(show.tour ? [{ k: "Tour", v: show.tourId ? <Link href={`/tours/${show.tourId}`}>{show.tour}</Link> : show.tour }] : []),
            { k: "Songs", v: `${setlist.length} · ${setCount} ${setCount === 1 ? "set" : "sets"}${encores > 0 ? ` + ${encores} encore${encores === 1 ? "" : "s"}` : ""}${durationLogged ? ` · ${durationLogged}` : ""}` },
            ...(show.permalink ? [{ k: "Source", v: <a href={`https://elgoose.net/setlists/${show.permalink}`} target="_blank" rel="noreferrer">elgoose.net</a> }] : []),
          ]}
        />
      </Doc>
    </Container>
  );
}
```

Add imports at the top of the file: `import { Doc, Breadcrumb, MetaTable } from "./doc";` (Link is already imported).

- [ ] **Step 2: Update the minimal setlist test**

Replace `app/_components/setlist/minimal.test.tsx`'s body assertions to expect a table + footnote ref instead of `<ol>`:

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

describe("SetlistMinimal (document)", () => {
  it("renders per-set tables, segue marks, and a jam footnote ref + note", () => {
    const html = renderToStaticMarkup(
      <SetlistMinimal entries={[
        entry({ song: "Hot Tea", transition: " > ", isJamchart: true, jamchartNotes: "huge jam", trackTime: "14:32" }),
        entry({ song: "Arrow", position: 2 }),
      ]} />,
    );
    expect(html).toContain("<table");
    expect(html).toContain("Hot Tea");
    expect(html).toContain("&gt;");      // segue
    expect(html).toContain("<sup");      // footnote ref
    expect(html).toContain("huge jam");  // footnote text
    expect(html).not.toContain("<svg");
  });
});
```

- [ ] **Step 3: Run test (RED)** — `npx vitest run app/_components/setlist/minimal.test.tsx` → fails (no `<table`/`<sup`).

- [ ] **Step 4: Rework SetlistMinimal into tables + footnotes**

Replace `app/_components/setlist/minimal.tsx`:

```tsx
import { groupSets, isSegue } from "./shared";
import { Footnotes, DocSection } from "../doc";
import type { SetlistEntry } from "@/lib/queries/shows";

export function SetlistMinimal({ entries }: { entries: SetlistEntry[] }) {
  if (entries.length === 0) {
    return <p>No setlist has been recorded for this show yet.</p>;
  }
  const groups = groupSets(entries);
  const notes: { id: string; text: string }[] = [];
  entries.forEach((e) => {
    if (e.isJamchart && e.jamchartNotes) notes.push({ id: `n-${e.uniqueId}`, text: `${e.song} — ${e.jamchartNotes}` });
  });
  const noteIndex = new Map(notes.map((n, i) => [n.id, i + 1]));

  return (
    <div>
      {groups.map((g) => (
        <DocSection key={g.key} title={g.label}>
          <table className="doc-table">
            <tbody>
              {g.entries.map((e, i) => {
                const nid = `n-${e.uniqueId}`;
                const fn = e.isJamchart && e.jamchartNotes ? noteIndex.get(nid) : undefined;
                return (
                  <tr key={e.uniqueId}>
                    <td className="num" style={{ width: "1.6rem" }}>{i + 1}</td>
                    <td>
                      {e.song}
                      {fn ? <sup><a href={`#${nid}`}>{fn}</a></sup> : null}
                      {isSegue(e.transition) ? " >" : ""}
                    </td>
                    <td className="num">{e.trackTime ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DocSection>
      ))}
      {notes.length > 0 && (
        <DocSection title="Jam notes">
          <Footnotes notes={notes} />
        </DocSection>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run tests (GREEN)** — `npx vitest run app/_components/setlist/minimal.test.tsx app/_components/show-header.test.tsx`, then `npm run typecheck` + `npm test`. (Note: `show-header.test.tsx`'s minimal case asserts `<dl`/`<h1`; update that assertion to `<table` for the MetaTable + keep `<h1`, since the minimal head now uses MetaTable not `<dl>`.)

- [ ] **Step 6: Commit**

```bash
git add app/_components/show-header.tsx app/_components/setlist/minimal.tsx app/_components/setlist/minimal.test.tsx app/_components/show-header.test.tsx
git commit -m "feat: minimal show-detail document — facts MetaTable + setlist tables + jam footnotes"
```

---

### Task 4: Minimal bodies for the show-list pages

**Files:** Modify `app/shows/page.tsx`, `app/years/[year]/page.tsx`, `app/on-this-day/page.tsx`, `app/search/page.tsx`.

Pattern for each: add `import { getExperience } from "@/lib/experience.server";`, the doc imports, `const experience = await getExperience();` after data fetch, and `if (experience === "minimal") return ( <minimal doc> );` BEFORE the existing `return`. Existing fancy/functional body unchanged.

- [ ] **Step 1: `/shows`** — after `const totalPages = …` and the existing `const experience = await getExperience();` (already present from prior work), and the `buildHref`/`countLine` definitions, add before the main `return`:

```tsx
if (experience === "minimal") {
  return (
    <Container className="py-8">
      <Doc>
        <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { label: "Shows" }]} />
        <h1>{year ? `Shows in ${year}` : "All shows"}</h1>
        <p className="doc-crumb">{countLine}</p>
        <p className="doc-crumb">
          Years: <Link href={buildHref({ year: null })}>All</Link>
          {years.map((y) => (<span key={y.year}> · <Link href={buildHref({ year: y.year })}>{y.year}</Link></span>))}
        </p>
        <ShowTable shows={rows} />
        {totalPages > 1 && (
          <p className="doc-crumb">
            {page > 1 ? <Link href={buildHref({ page: page - 1 })}>← Previous</Link> : null}
            {" "}Page {page} of {totalPages}{" "}
            {page < totalPages ? <Link href={buildHref({ page: page + 1 })}>Next →</Link> : null}
          </p>
        )}
      </Doc>
    </Container>
  );
}
```
Imports to add: `import { Doc, Breadcrumb, ShowTable } from "@/app/_components/doc";` (Container, Link, getExperience already imported).

- [ ] **Step 2: `/years/[year]`** — add `getExperience` + doc imports; after data fetch (`rows`, `total`, `years`, `year`, and the prev/next year values it computes), add before the main return:

```tsx
if (experience === "minimal") {
  return (
    <Container className="py-8">
      <Doc>
        <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { href: "/shows", label: "Shows" }, { label: String(year) }]} />
        <h1>{year}</h1>
        <p className="doc-crumb">{rows.length} {rows.length === 1 ? "show" : "shows"}</p>
        <ShowTable shows={rows} />
      </Doc>
    </Container>
  );
}
```
(Use the page's actual `rows`/`year` variable names; `const experience = await getExperience();` after the `Promise.all`.)

- [ ] **Step 3: `/on-this-day`** — add imports + `const experience = await getExperience();` after `getOnThisDay()` (variable `rows`). Before the main return:

```tsx
if (experience === "minimal") {
  return (
    <Container className="py-8">
      <Doc>
        <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { label: "On this day" }]} />
        <h1>On this day</h1>
        {rows.length === 0 ? <p>No Goose shows on today’s date.</p> : <ShowTable shows={rows} />}
      </Doc>
    </Container>
  );
}
```

- [ ] **Step 4: `/search`** — add imports + `const experience = await getExperience();`. The page has `term`, and (when present) `shows: ShowSummary[]`, `venues: VenueRow[]`, `tours: TourRow[]`. Before the main return:

```tsx
if (experience === "minimal") {
  return (
    <Container className="py-8">
      <Doc>
        <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { label: "Search" }]} />
        <h1>{term ? `Search: ${term}` : "Search"}</h1>
        {!term ? <p>Enter a query in the address bar: <code>/search?q=red+rocks</code></p> : (
          <>
            {shows.length > 0 && <DocSection title="Shows"><ShowTable shows={shows} /></DocSection>}
            {venues.length > 0 && <DocSection title="Venues"><EntityTable rows={venues.map((v) => ({ href: `/venues/${v.venueId}`, name: v.name, sub: locationLine(v.city, v.state, v.country), count: v.shows }))} /></DocSection>}
            {tours.length > 0 && <DocSection title="Tours"><EntityTable rows={tours.map((t) => ({ href: `/tours/${t.tourId}`, name: t.name, count: t.shows }))} /></DocSection>}
            {shows.length === 0 && venues.length === 0 && tours.length === 0 && <p>No results for “{term}”.</p>}
          </>
        )}
      </Doc>
    </Container>
  );
}
```
Imports: `import { Doc, Breadcrumb, ShowTable, EntityTable, DocSection } from "@/app/_components/doc";` and `locationLine` from format (add if not present). Use the page's actual variable names for `term`/`shows`/`venues`/`tours` (they may be conditionally defined — place the minimal branch where those are in scope, mirroring the page's existing guards).

- [ ] **Step 5: Verify** — `npm run typecheck` (clean) and `npm test` (green). Visually deferred to Task 7.

- [ ] **Step 6: Commit**

```bash
git add app/shows/page.tsx "app/years/[year]/page.tsx" app/on-this-day/page.tsx app/search/page.tsx
git commit -m "feat: minimal document bodies for shows/years/on-this-day/search"
```

---

### Task 5: Minimal bodies for the entity pages (venues + tours)

**Files:** Modify `app/venues/page.tsx`, `app/venues/[id]/page.tsx`, `app/tours/page.tsx`, `app/tours/[id]/page.tsx`.

Same pattern (add `getExperience` + doc imports + minimal branch before the main return).

- [ ] **Step 1: `/venues`** (`venues: VenueRow[]`):

```tsx
if (experience === "minimal") {
  return (
    <Container className="py-8">
      <Doc>
        <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { label: "Venues" }]} />
        <h1>Venues</h1>
        <p className="doc-crumb">{venues.length} venues</p>
        <EntityTable rows={venues.map((v) => ({ href: `/venues/${v.venueId}`, name: v.name, sub: locationLine(v.city, v.state, v.country), count: v.shows }))} />
      </Doc>
    </Container>
  );
}
```

- [ ] **Step 2: `/venues/[id]`** (`venue: VenueRow`, `shows: ShowSummary[]`):

```tsx
if (experience === "minimal") {
  return (
    <Container className="py-8">
      <Doc>
        <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { href: "/venues", label: "Venues" }, { label: venue.name }]} />
        <h1>{venue.name}</h1>
        <MetaTable rows={[
          { k: "Location", v: locationLine(venue.city, venue.state, venue.country) || "—" },
          ...(venue.capacity && venue.capacity > 0 ? [{ k: "Capacity", v: compact(venue.capacity) }] : []),
          { k: "Shows", v: venue.shows },
          ...(venue.first ? [{ k: "First", v: venue.first }] : []),
          ...(venue.last ? [{ k: "Last", v: venue.last }] : []),
        ]} />
        <DocSection title="Shows here"><ShowTable shows={shows} /></DocSection>
      </Doc>
    </Container>
  );
}
```

- [ ] **Step 3: `/tours`** (`tours: TourRow[]`):

```tsx
if (experience === "minimal") {
  return (
    <Container className="py-8">
      <Doc>
        <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { label: "Tours" }]} />
        <h1>Tours</h1>
        <p className="doc-crumb">{tours.length} tours</p>
        <EntityTable rows={tours.map((t) => ({ href: `/tours/${t.tourId}`, name: t.name, sub: t.start && t.end ? `${formatShortDate(t.start)} – ${formatShortDate(t.end)}` : String(t.year), count: t.shows }))} />
      </Doc>
    </Container>
  );
}
```

- [ ] **Step 4: `/tours/[id]`** (`tour: TourRow`, `shows: ShowSummary[]`):

```tsx
if (experience === "minimal") {
  return (
    <Container className="py-8">
      <Doc>
        <Breadcrumb trail={[{ href: "/", label: "Goose Almanac" }, { href: "/tours", label: "Tours" }, { label: tour.name }]} />
        <h1>{tour.name}</h1>
        <MetaTable rows={[
          { k: "Year", v: tour.year },
          ...(tour.start && tour.end ? [{ k: "Dates", v: `${formatShortDate(tour.start)} – ${formatShortDate(tour.end)}` }] : []),
          { k: "Shows", v: tour.shows },
        ]} />
        <DocSection title="Shows"><ShowTable shows={shows} /></DocSection>
      </Doc>
    </Container>
  );
}
```

Imports per file: the relevant subset of `{ Doc, Breadcrumb, ShowTable, EntityTable, MetaTable, DocSection } from "@/app/_components/doc"`, plus `locationLine`/`formatShortDate`/`compact` from format (add any not already imported), `getExperience` from server, `Container`/`Link` (already imported).

- [ ] **Step 5: Verify** — `npm run typecheck` + `npm test`.

- [ ] **Step 6: Commit**

```bash
git add app/venues/page.tsx "app/venues/[id]/page.tsx" app/tours/page.tsx "app/tours/[id]/page.tsx"
git commit -m "feat: minimal document bodies for venues + tours"
```

---

### Task 6: Minimal home document

**Files:** Modify `app/page.tsx`.

The home page fetches `stats: OverviewStats`, `recent: ShowSummary[]`, `upcoming: ShowSummary[]`, `onThisDay: ShowSummary[]`.

- [ ] **Step 1: Add the minimal branch**

Add `import { getExperience } from "@/lib/experience.server";`, `import { Doc, MetaTable, ShowTable, DocSection } from "@/app/_components/doc";`, `const experience = await getExperience();` after the `Promise.all`, and before the main return:

```tsx
if (experience === "minimal") {
  return (
    <Container className="py-8">
      <Doc>
        <h1>Goose Almanac</h1>
        <p>An almanac of every Goose show — setlists, segues, jams, venues, and tours. Setlist data from <a href="https://elgoose.net" target="_blank" rel="noreferrer">elgoose.net</a>.</p>
        <MetaTable rows={[
          { k: "Shows", v: compact(stats.showsPlayed) },
          { k: "Songs", v: compact(stats.songs) },
          { k: "Venues", v: compact(stats.venues) },
          { k: "Performances", v: compact(stats.performances) },
          ...(stats.firstDate ? [{ k: "First show", v: stats.firstDate }] : []),
          ...(stats.lastPlayedDate ? [{ k: "Last show", v: stats.lastPlayedDate }] : []),
        ]} />
        {onThisDay.length > 0 && <DocSection title="On this day"><ShowTable shows={onThisDay.slice(0, 6)} /></DocSection>}
        <DocSection title="Recent shows"><ShowTable shows={recent} /></DocSection>
        {upcoming.length > 0 && <DocSection title="Upcoming"><ShowTable shows={upcoming} /></DocSection>}
        <DocSection title="Browse">
          <p><Link href="/shows">All shows</Link> · <Link href="/venues">Venues</Link> · <Link href="/tours">Tours</Link> · <Link href="/on-this-day">On this day</Link></p>
        </DocSection>
      </Doc>
    </Container>
  );
}
```
(Add `compact` from format if not imported; `Container`/`Link` already imported.)

- [ ] **Step 2: Verify** — `npm run typecheck` + `npm test`.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: minimal home document (stats table + recent/on-this-day/upcoming)"
```

---

### Task 7: Verify + ship

- [ ] **Step 1: Full gate** — stop any dev server, then `npm test`, `npm run typecheck`, `npm run build` (all pass).
- [ ] **Step 2: Compiled CSS** — `CSS=$(ls -t .next/static/css/*.css | head -1); grep -c 'data-experience=minimal\]{[^}]*--type-display:Georgia' "$CSS"` → 1; `grep -c 'table.doc-table' "$CSS"` → ≥1.
- [ ] **Step 3: Mark spec built** — in `docs/superpowers/specs/2026-06-28-minimal-document.md`, `Status: proposed` → `Status: built 2026-06-28`; commit.
- [ ] **Step 4: (controller) merge to main, deploy, live-verify** — confirm minimal renders a serif document with tables on `/`, `/shows`, a show page (setlist tables + footnotes), `/venues`, a venue, `/tours`, a tour, `/on-this-day`, `/search?q=red+rocks`; fancy + functional unchanged.

---

## Self-Review

**Spec coverage:** serif + doc CSS → Task 1; primitives → Task 2; show-detail document (facts table, setlist tables, footnotes) → Task 3; every other page's minimal body → Tasks 4 (shows/years/on-this-day/search), 5 (venues/tours), 6 (home); chrome (serif breadcrumb header/footer) → already minimal-plain from the prior branch, now serif via Task 1's `--type-*` switch; verify → Task 7. ✓

**Placeholder scan:** Primitive + CSS + show-detail code is complete; per-page branches give exact JSX against the mapped data variables, instructing the implementer to use the page's actual variable names where a page may guard them (search). Commands have expected output.

**Type consistency:** `ShowTable({shows})`, `EntityTable({rows})`, `MetaTable({rows})`, `Breadcrumb({trail})`, `DocSection({title,children})`, `Footnotes({notes})`, `Doc({children})` defined once in Task 2 and consumed with matching props in Tasks 3–6. `ShowSummary`/`VenueRow`/`TourRow`/`OverviewStats` field names match the verified shapes.
