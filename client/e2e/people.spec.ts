import { expect, type Page, test } from "@playwright/test";

import { fixturePath, fulfillFixture } from "./resourceFixture";

async function openPeople(page: Page, viewerRole = "Owner", language = "en") {
  const people = [
    {
      id: "owner",
      displayName: "Gabriel Ionescu",
      roles: ["Owner"],
      email: "gabriel@example.test",
      hasPassword: true,
    },
    {
      id: "admin",
      displayName: "Elena Dumitrescu",
      roles: ["Admin"],
      email: "elena@example.test",
      phoneNumber: "+40 722 345 678",
      hasPassword: true,
    },
    {
      id: "client",
      displayName: "Ștefan Popescu",
      clientName: "Reședința Nord — clădirea administrativă și spațiile comerciale",
      roles: ["Client"],
      email: "contact.administratie.cladire@example.test",
      phoneNumber: "+40 733 456 789",
      hasPassword: true,
    },
    {
      id: "pending",
      activeLinkExpiresAt: "2099-01-01T00:00:00Z",
      displayName: "Ana Maria Vasilescu",
      clientName: "Casa din livadă",
      roles: ["Client"],
      email: "ana@example.test",
      hasPassword: false,
    },
    {
      id: "disabled",
      displayName: "Mihai Constantinescu",
      roles: ["Client"],
      hasPassword: true,
      disabled: true,
    },
  ];
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const path = fixturePath(route.request().url(), route.request().method());
    const data = path.endsWith("setup-status")
      ? { required: false }
      : path.endsWith("/me")
        ? { ...people[viewerRole === "Owner" ? 0 : 1], language }
        : path.endsWith("/admin/users")
          ? people
          : [];
    await fulfillFixture(route, { json: data });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: language === "en" ? "Account menu" : "Meniu cont" })
    .click();
  await page
    .getByRole("button", { name: language === "en" ? "User management" : "Gestionare utilizatori" })
    .click();
  await expect(page.locator(".people-row")).toHaveCount(5);
}

test("people directory is responsive, searchable, and keeps account actions protected", async ({
  page,
}, info) => {
  await openPeople(page);
  await expect(page.getByRole("heading", { name: "People & access" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("people-directory.png"), fullPage: true });
  await page.locator(".people-row").filter({ hasText: "Ștefan Popescu" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("people-rows.png"), fullPage: true });
  expect(
    await page.locator(".people-directory").evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const search = page.getByRole("searchbox", { name: "Search people" });
  await search.fill("stefan");
  await expect(page.locator(".people-row")).toHaveCount(1);
  await expect(page.getByText("Ștefan Popescu", { exact: true })).toBeVisible();
  await search.fill("");
  await page.getByRole("combobox", { name: "Filter by role" }).selectOption("Client");
  await page.getByRole("button", { name: "Pending activation", exact: true }).click();
  await expect(page.locator(".people-row")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Generate activation link" })).toBeVisible();
  await page.getByLabel("Menu Ana Maria Vasilescu", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Revoke links" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("Menu Ana Maria Vasilescu", { exact: true }).press("Escape");
  await expect(page.getByRole("button", { name: "Revoke links" })).toBeHidden();
  await search.fill("no results");
  await expect(page.getByText("No matching people")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".people-row")).toHaveCount(5);
  const disabled = page.locator(".people-row").filter({ hasText: "Mihai Constantinescu" });
  await expect(disabled.getByRole("button", { name: "Reset password" })).toHaveCount(0);
  await disabled.getByLabel("Menu Mihai Constantinescu", { exact: true }).click();
  await expect(disabled.getByRole("button", { name: "Activate", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("people-actions.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Romanian directory keeps owner and admin peers protected", async ({ page }, info) => {
  await openPeople(page, "Admin", "ro");
  await expect(page.getByRole("heading", { name: "Persoane și acces" })).toBeVisible();
  const owner = page.locator(".people-row").filter({ hasText: "Gabriel Ionescu" });
  const admin = page.locator(".people-row").filter({ hasText: "Elena Dumitrescu" });
  await expect(owner.locator("summary")).toHaveCount(0);
  await expect(admin.locator("summary")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("people-romanian.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
