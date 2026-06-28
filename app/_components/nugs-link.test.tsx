import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NugsLink } from "./nugs-link";

describe("NugsLink", () => {
  it("renders the applenugs href, carries the fallback, and children", () => {
    const html = renderToStaticMarkup(
      <NugsLink
        href="applenugs://show/2024-04-20?artist=Goose"
        fallback="https://play.nugs.net/#/search?q=Goose%202024-04-20"
        className="nugs-track"
        title="Listen on nugs"
      >▷</NugsLink>,
    );
    expect(html).toContain('href="applenugs://show/2024-04-20?artist=Goose"');
    expect(html).toContain('data-fallback="https://play.nugs.net/#/search?q=Goose%202024-04-20"');
    expect(html).toContain("nugs-track");
    expect(html).toContain("▷");
  });
});
