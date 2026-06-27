import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HeaderFancy, HeaderFunctional, HeaderMinimal } from "./site-header";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: () => {},
    push: () => {},
  }),
  usePathname: () => "/",
}));

describe("SiteHeader variants", () => {
  it("fancy has the feather logo mark and is sticky", () => {
    const html = renderToStaticMarkup(<HeaderFancy experience="fancy" />);
    expect(html).toContain("<svg");
    expect(html).toContain("sticky");
  });
  it("functional is slim and mono, no rounded logo mark", () => {
    const html = renderToStaticMarkup(<HeaderFunctional experience="functional" />);
    expect(html).toContain("font-mono");
    expect(html).not.toContain("h-16");
  });
  it("minimal is a plain text nav: no svg, not sticky, underlined links", () => {
    const html = renderToStaticMarkup(<HeaderMinimal experience="minimal" />);
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("sticky");
    expect(html).toContain("underline");
    expect(html).toContain("Shows");
  });
});
