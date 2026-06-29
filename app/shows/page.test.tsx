import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const h = vi.hoisted(() => ({
  latest: null as null | { showId: number; date: string; isToday: boolean; page: number },
  rows: [] as Record<string, unknown>[],
  total: 1,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock("@/lib/experience.server", () => ({ getExperience: async () => "fancy" }));
vi.mock("@/lib/queries/dimensions", () => ({
  listYears: async () => [
    { year: 2024, shows: 10, songs: 100 },
    { year: 2023, shows: 8, songs: 80 },
  ],
  listTours: async () => [
    { tourId: 1, name: "Summer Tour 2024", year: 2024, shows: 5, start: "2024-06-01", end: "2024-08-01" },
    { tourId: 2, name: "Fall Tour 2024", year: 2024, shows: 4, start: "2024-09-01", end: "2024-11-01" },
    { tourId: 3, name: "Winter Tour 2023", year: 2023, shows: 3, start: "2023-12-01", end: "2023-12-20" },
  ],
}));
vi.mock("@/lib/queries/shows", () => ({
  listShows: async () => ({ rows: h.rows, total: h.total }),
  findLatestPastShow: async () => h.latest,
}));

import ShowsBrowsePage from "./page";

async function render(params: Record<string, string> = {}) {
  const el = await ShowsBrowsePage({ searchParams: Promise.resolve(params) });
  return renderToStaticMarkup(el);
}

beforeEach(() => {
  h.latest = { showId: 42, date: "2024-06-15", isToday: false, page: 1 };
  h.rows = [{
    showId: 42, date: "2024-06-15", order: 1, venue: "The Cap", city: "Port Chester",
    state: "NY", country: "USA", tour: "Summer Tour 2024", tourId: 1, songCount: 12, hasNotes: false,
  }];
  h.total = 1;
});

describe("ShowsBrowsePage controls", () => {
  it("offers 50/100 per-page options with 50 the default", async () => {
    const html = await render();
    expect(html).toContain(">50<");
    expect(html).toContain(">100<");
    // default per=50 means the 100 link must carry per=100
    expect(html).toContain("per=100");
  });

  it("hides the tour filter row until a year is chosen", async () => {
    const noYear = await render();
    expect(noYear).not.toContain("All 2024"); // no clear-tour pill
    expect(noYear).not.toContain("tour=1"); // no tour filter links

    const withYear = await render({ year: "2024" });
    expect(withYear).toContain("All 2024"); // clear-tour pill present
    expect(withYear).toContain("year=2024&amp;tour=1"); // Summer Tour 2024 pill
    expect(withYear).toContain("year=2024&amp;tour=2"); // Fall Tour 2024 pill
    expect(withYear).not.toContain("tour=3"); // Winter Tour 2023 belongs to 2023
  });

  it("shows a 'Most recent show' jump that deep-links to the show anchor", async () => {
    const html = await render();
    expect(html).toContain("Most recent show");
    expect(html).toContain("#show-42");
  });

  it("targets the right page in the jump link", async () => {
    h.latest = { showId: 42, date: "2024-06-15", isToday: false, page: 3 };
    const html = await render();
    expect(html).toContain("page=3#show-42");
  });

  it("relabels the jump as tonight's show when a show is today", async () => {
    h.latest = { showId: 99, date: "2024-06-29", isToday: true, page: 1 };
    const html = await render();
    expect(html).toContain("Tonight");
    expect(html).not.toContain("Most recent show");
  });

  it("hides the jump entirely when there is no past show", async () => {
    h.latest = null;
    const html = await render();
    expect(html).not.toContain("Most recent show");
    expect(html).not.toContain("Tonight");
  });
});
