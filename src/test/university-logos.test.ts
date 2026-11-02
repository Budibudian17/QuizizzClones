import { describe, expect, it } from "vitest";

import { getWikipediaThumbnail } from "@/game/university-logos";

describe("Wikipedia university thumbnails", () => {
  it("accepts HTTPS Wikimedia thumbnail URLs", () => {
    expect(
      getWikipediaThumbnail({
        thumbnail: {
          source: "https://thumb.wikimedia.org/wikipedia/id/thumb/logo.png",
        },
      }),
    ).toBe("https://thumb.wikimedia.org/wikipedia/id/thumb/logo.png");
  });

  it("rejects malformed, insecure, or third-party image URLs", () => {
    expect(getWikipediaThumbnail(null)).toBeNull();
    expect(getWikipediaThumbnail({})).toBeNull();
    expect(
      getWikipediaThumbnail({ thumbnail: { source: "http://thumb.wikimedia.org/a.png" } }),
    ).toBeNull();
    expect(
      getWikipediaThumbnail({ thumbnail: { source: "https://example.com/logo.png" } }),
    ).toBeNull();
  });
});
