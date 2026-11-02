import { expect, test } from "@playwright/test";

import { fixturePath, fulfillFixture } from "./resourceFixture";

test("signed-in preferences, localized folder labels and account language saving", async ({
  page,
}, info) => {
  let language = "en";
  let profile: Record<string, unknown> = {};
  const folders = [
    { id: "root", name: "Root", parentId: null, sectionKey: null },
    ...[
      ["progress", ".progress"],
      ["contracts", ".contracts"],
      ["warranty", ".warranty"],
      ["maintenance", ".maintanance"],
      ["technical", ".technicaldocs"],
    ].map(([key, name]) => ({
      id: key,
      name,
      sectionKey: key,
      parentId: "root",
      clientVisible: true,
      canUpload: true,
    })),
  ];
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const path = fixturePath(route.request().url(), route.request().method());
    if (path.endsWith("/profile")) {
      profile = route.request().postDataJSON();
      language = String(profile.language);

      return fulfillFixture(route, { status: 200, body: "" });
    }

    const body = path.endsWith("setup-status")
      ? { required: false }
      : path.endsWith("/me")
        ? {
            id: "owner",
            displayName: "Ana",
            language,
            roles: ["Owner"],
            email: "ana@example.test",
            hasPassword: true,
          }
        : path.endsWith("/clients") || path.endsWith("/users")
          ? []
          : path === "/api/projects"
            ? [{ id: "p1", name: "Casa Ana", code: "CA-1000" }]
            : path === "/api/projects/p1"
              ? {
                  project: {
                    id: "p1",
                    name: "Casa Ana",
                    code: "CA-1000",
                    milestones: [],
                    manager: "Ana",
                    nextMaintenanceDate: "2026-02-10",
                  },
                  folders,
                  files: [],
                  sections: folders
                    .filter((f) => f.sectionKey)
                    .map((f) => ({
                      key: f.sectionKey,
                      name: f.name,
                      canUpload: true,
                      clientVisible: true,
                    })),
                  updates: [],
                  events: [],
                }
              : [];
    await fulfillFixture(route, { json: body });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Casa Ana" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  }

  await page.getByRole("button", { name: "File Manager", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Shared with the client Maintenance & Interventions",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(".maintanance", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: `test-results/localization-en-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Account settings" }).click();
  const languageField = page.getByLabel("Preferred language");
  const nameField = page.getByLabel("Full name");
  const languageSize = await languageField.boundingBox();
  const nameSize = await nameField.boundingBox();
  expect(languageSize!.height).toBe(nameSize!.height);
  expect(languageSize!.width).toBe(nameSize!.width);
  await languageField.selectOption("ro");
  await page.getByLabel("Current password to save changes").fill("owner1");
  await page.getByRole("button", { name: "Save account details" }).click();
  await expect(page.getByRole("heading", { name: "Setări cont" })).toBeVisible();
  expect(profile.language).toBe("ro");
  await expect(page.locator("html")).toHaveAttribute("lang", "ro");
  await page.getByRole("button", { name: "Închide", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Partajat cu clientul Mentenanță & Intervenții",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ro");
});
test("invalid preference falls back to English and anonymous users can choose Romanian", async ({
  page,
}) => {
  let signedIn = true;
  await page.route(/^http:\/\/localhost:5173\/api\//, (route) => {
    const path = fixturePath(route.request().url(), route.request().method());
    if (path.endsWith("/me") && !signedIn) {
      return fulfillFixture(route, { status: 401, body: "" });
    }

    return fulfillFixture(route, {
      json: path.endsWith("setup-status")
        ? { required: false }
        : path.endsWith("/me")
          ? { id: "u", displayName: "Ana", language: "invalid", roles: ["Client"] }
          : [],
    });
  });
  await page.goto("/");
  await expect(page.getByText("You have no assigned projects yet")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  signedIn = false;
  await page.reload();
  await expect(page.getByLabel("Preferred language")).toHaveCount(0);
  await page.getByRole("button", { name: "Română", exact: true }).click();
  await expect(page.getByRole("button", { name: "Autentificare", exact: true })).toBeVisible();
  await page.getByLabel("Email").fill("ana@example.test");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByLabel("Email")).toHaveValue("ana@example.test");
});
