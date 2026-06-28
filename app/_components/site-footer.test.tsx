import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FooterMinimal, FooterFunctional, FooterFancy } from "./site-footer";

describe("SiteFooter variants", () => {
  it("minimal is one plain line with the elgoose credit and no logo", () => {
    const html = renderToStaticMarkup(<FooterMinimal />);
    expect(html).not.toContain("<svg");
    expect(html).toContain("elgoose.net");
    expect(html).not.toContain("Browse");
  });
  it("fancy keeps the multi-column footer with Browse", () => {
    const html = renderToStaticMarkup(<FooterFancy />);
    expect(html).toContain("Browse");
    expect(html).toContain("<svg");
  });
  it("functional is a single slim mono row", () => {
    const html = renderToStaticMarkup(<FooterFunctional />);
    expect(html).toContain("w2-appbar");
    expect(html).not.toContain("Browse");
  });
});
