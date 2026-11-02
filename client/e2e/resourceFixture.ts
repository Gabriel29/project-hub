import type { Route } from "@playwright/test";

import { splitApiFixture } from "../src/test/splitApiFixture";

export { fixturePath } from "../src/test/splitApiFixture";

export function fulfillFixture(
  route: Route,
  options: Parameters<Route["fulfill"]>[0],
  manager = true,
) {
  return route.fulfill({
    ...options,
    json: options?.json ? splitApiFixture(route.request().url(), options.json, manager) : undefined,
  });
}
