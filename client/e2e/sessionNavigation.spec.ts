import { expect, test } from "@playwright/test";

import { fixturePath, fulfillFixture } from "./resourceFixture";

test("reset links open after logout without reloading and clear stale password fields", async ({
  page,
}) => {
  let signedIn = true;
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const path = fixturePath(route.request().url(), route.request().method());
    if (path.endsWith("/logout")) {
      signedIn = false;

      return fulfillFixture(route, { json: {} });
    }

    if (path.endsWith("/me")) {
      return fulfillFixture(route, {
        status: signedIn ? 200 : 401,
        json: signedIn
          ? { id: "owner", displayName: "Owner", roles: ["Owner"], language: "en" }
          : {},
      });
    }

    return fulfillFixture(route, {
      json: path.endsWith("setup-status") ? { required: false } : [],
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome", exact: true })).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("stale-password");
  await page.evaluate(() => {
    (window as Window & { navigationMarker?: string }).navigationMarker = "same-document";
    location.hash = "reset=synthetic-reset-one";
  });
  await expect(page.getByRole("heading", { name: "New password", exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => (window as Window & { navigationMarker?: string }).navigationMarker),
  ).toBe("same-document");
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue("");
  await page.getByLabel("New password", { exact: true }).fill("firstone1");
  await page.evaluate(() => {
    location.hash = "reset=synthetic-reset-two";
  });
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue("");
  await page.getByLabel("New password", { exact: true }).fill("updated1");
  await page.getByLabel("Confirm password", { exact: true }).fill("updated1");
  const submitted = page.waitForRequest(
    (request) => request.url().endsWith("/api/auth/reset") && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();
  expect((await submitted).postDataJSON()).toEqual({
    token: "synthetic-reset-two",
    password: "updated1",
  });
  await expect(page.getByRole("heading", { name: "Welcome", exact: true })).toBeVisible();
});
