import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("keeps the player join page separate from the host dashboard", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    expect(router.matchRoutes("/join").at(-1)?.routeId).toBe("/join");
    expect(router.matchRoutes("/dashboard").at(-1)?.routeId).toBe("/dashboard");
    expect(router.matchRoutes("/player-dashboard").at(-1)?.routeId).toBe("/player-dashboard");
    expect(router.matchRoutes("/practice").at(-1)?.routeId).toBe("/practice");
  });
});
