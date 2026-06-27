import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { JsonLd } from "./json-ld";

describe("JsonLd", () => {
  it("escapes </script> sequences to prevent script injection breakout", () => {
    const data = { name: "Bad </script><script>alert(1)</script> Venue" };
    const html = renderToStaticMarkup(<JsonLd data={data} />);

    // Must not contain raw breakout sequence
    expect(html).not.toContain("</script><script>alert");

    // Must contain the unicode-escaped form of <
    expect(html).toContain("\\u003c");

    // The JSON-LD payload must still round-trip (data is preserved)
    const match = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const body = match![1].replace(/\\u003c/g, "<");
    const parsed = JSON.parse(body);
    expect(parsed.name).toContain("Bad </script><script>alert(1)</script> Venue");
  });
});
