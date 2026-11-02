import { expect, test } from "@playwright/test";

import { fixturePath, fulfillFixture } from "./resourceFixture";

for (const role of ["Owner", "Admin", "Client"]) {
  test(`recent files have separate actions and correct access for ${role}`, async ({
    page,
  }, info) => {
    const folders = [
      { id: "root", parentId: null, sectionKey: null, name: "Root", clientVisible: false },
      {
        id: "contracts",
        parentId: "root",
        sectionKey: "contracts",
        name: ".contracts",
        clientVisible: true,
      },
      { id: "child", parentId: "contracts", sectionKey: null, name: "Signed", clientVisible: true },
      {
        id: "progress",
        parentId: "root",
        sectionKey: "progress",
        name: ".progress",
        clientVisible: true,
      },
    ];
    const file = (id: string, folderId: string, contentType: string, calendarPhoto = false) => ({
      id,
      title: id,
      folderId,
      calendarPhoto,
      content: { id, contentType, fileName: id + ".pdf", createdAt: "2026-10-15", size: 100 },
      description: "",
    });
    const files = [
      file("Contract", "child", "application/pdf"),
      file("Private", "root", "application/pdf"),
      file("Photo", "progress", "image/png", true),
      file("Spreadsheet", "contracts", "application/octet-stream"),
      file("Reference", "child", "image/png"),
    ];
    await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
      const path = fixturePath(route.request().url(), route.request().method());
      if (path.endsWith("/content")) {
        if (route.request().url().endsWith("?inline=true")) {
          return fulfillFixture(route, {
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#dbe7e9"/></svg>',
          });
        }

        return fulfillFixture(route, {
          contentType: "application/octet-stream",
          headers: { "Content-Disposition": 'attachment; filename="Contract.pdf"' },
          body: "Test document",
        });
      }

      return fulfillFixture(route, {
        json: path.endsWith("setup-status")
          ? { required: false }
          : path.endsWith("/me")
            ? { id: "user", displayName: "Ana", language: "en", roles: [role] }
            : path.endsWith("/clients") || path.endsWith("/users")
              ? []
              : path === "/api/projects"
                ? [{ id: "p1", name: "Casa Ana", code: "CA-1000" }]
                : path === "/api/projects/p1"
                  ? {
                      project: { id: "p1", name: "Casa Ana", code: "CA-1000", milestones: [] },
                      folders,
                      files,
                      sections: [],
                      updates: [],
                      events: [],
                    }
                  : [],
      });
    });
    await page.goto("/");
    const recent = page.locator(".recent-documents");
    await expect(recent.getByRole("heading", { name: "Recent documents" })).toBeVisible();
    await expect(recent.locator(".recent-document-link")).toHaveCount(3);
    await expect(recent.getByText("Private", { exact: true })).toHaveCount(0);
    await expect(recent.getByRole("link", { name: "Open Photo", exact: true })).toHaveCount(0);
    await expect(recent.getByRole("button", { name: "View all", exact: true })).toHaveCount(
      role === "Owner" ? 1 : 0,
    );
    await recent.getByRole("link", { name: "Open Contract", exact: true }).click();
    await expect(page.getByRole("dialog").locator("iframe")).toHaveAttribute(
      "src",
      "/api/projects/p1/files/Contract/content?inline=true",
    );
    await page.getByRole("button", { name: "Close", exact: true }).click();
    const downloading = page.waitForEvent("download");
    await recent.getByRole("link", { name: "Download Contract", exact: true }).click();
    expect((await downloading).suggestedFilename()).toBe("Contract.pdf");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await recent.getByRole("link", { name: "Open Reference", exact: true }).click();
    await expect(page.getByRole("dialog").locator("img")).toHaveAttribute("alt", "Reference");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    const sheetDownload = page.waitForEvent("download");
    await recent.getByRole("link", { name: "Open Spreadsheet", exact: true }).click();
    await sheetDownload;
    const row = recent.locator(".recent-document-link").first();
    const primary = await row.locator(".recent-document-open").boundingBox();
    const actions = await row.locator(".recent-document-actions").boundingBox();
    expect(actions!.x).toBeGreaterThan(primary!.x + primary!.width - 1);
    await page.screenshot({ path: info.outputPath(`recent-${role}.png`), fullPage: true });
    if (role === "Owner") {
      await recent.getByRole("button", { name: "View all", exact: true }).click();
      await expect(page.getByRole("heading", { name: "File Manager" })).toBeVisible();
      if (info.project.name === "mobile") {
        await page.getByRole("button", { name: "Menu", exact: true }).click();
      }

      await page
        .locator(".sidebar nav")
        .getByRole("button", { name: "Dashboard", exact: true })
        .click();
    }

    await recent
      .getByRole("button", { name: "Open Contractual documents tab for Contract" })
      .click();
    await expect(page.getByRole("heading", { name: "Contractual documents" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Contract", exact: true })).toBeVisible();
  });
}
