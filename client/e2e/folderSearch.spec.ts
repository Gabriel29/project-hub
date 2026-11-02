import { expect, test } from "@playwright/test";

import { fixturePath, fulfillFixture } from "./resourceFixture";

for (const role of ["Owner", "Admin", "Client"]) {
  test(`recursive search stays in its location and opens results for ${role}`, async ({
    page,
  }, info) => {
    const folder = (
      id: string,
      name: string,
      parentId: string | null,
      sectionKey: string | null = null,
    ) => ({ id, name, parentId, sectionKey, clientVisible: true, canUpload: role !== "Client" });
    const folders = [
      folder("root", "Root", null),
      folder("contracts", ".contracts", "root", "contracts"),
      folder("branch", "Archive", "contracts"),
      folder("deep", "Signed documents", "branch"),
      folder("match", "Planșe aprobate", "deep"),
      folder("warranty", ".warranty", "root", "warranty"),
    ];
    const file = (id: string, title: string, folderId: string, fileName = title + ".pdf") => ({
      id,
      title,
      folderId,
      description: "",
      content: { id, fileName, contentType: "application/pdf", size: 10, createdAt: "2026-10-15" },
    });
    const files = [
      file("top", "Plan top", "contracts"),
      file("nested", "Planșe signed", "deep"),
      file("filename", "Drawing", "match", "PLAN-final.pdf"),
      file("outside", "Plan outside", "warranty"),
    ];
    await page.route(/^http:\/\/localhost:5173\/api\//, (route) => {
      const path = fixturePath(route.request().url(), route.request().method());
      if (
        path === "/api/projects/p1/files/folders/branch/name" &&
        route.request().method() === "PUT"
      ) {
        folders.find((folder) => folder.id === "branch")!.name = route
          .request()
          .postDataJSON().name;

        return fulfillFixture(route, { json: {} });
      }

      if (path === "/api/projects/p1/files/nested/name" && route.request().method() === "PUT") {
        files.find((file) => file.id === "nested")!.title = route.request().postDataJSON().title;

        return fulfillFixture(route, { json: {} });
      }

      return fulfillFixture(route, {
        json: path.endsWith("setup-status")
          ? { required: false }
          : path.endsWith("/me")
            ? { id: "u1", language: "en", displayName: role, roles: [role] }
            : path.endsWith("/clients") || path.endsWith("/users")
              ? []
              : path === "/api/projects"
                ? [{ id: "p1", name: "Search project", code: "SP-1000" }]
                : path === "/api/projects/p1"
                  ? {
                      project: {
                        id: "p1",
                        name: "Search project",
                        code: "SP-1000",
                        milestones: [],
                      },
                      folders: role === "Client" ? folders.filter((f) => f.id !== "root") : folders,
                      files,
                      updates: [],
                      events: [],
                      sections: [{ key: "contracts" }, { key: "warranty" }],
                    }
                  : [],
      });
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Search project" })).toBeVisible();
    const navigate = async (name: string) => {
      if (info.project.name === "mobile") {
        await page.getByRole("button", { name: "Menu", exact: true }).click();
      }

      await page.locator(".sidebar nav").getByRole("button", { name, exact: true }).click();
    };

    await navigate("Contractual documents");
    const search = page.getByRole("textbox", { name: "Search documents" });
    const results = page.locator(".folder-grid");
    await search.fill("PLANSE");
    await expect(results.locator(".document-tile")).toHaveCount(2);
    await search.fill("  pLaN  ");
    await expect(results.locator(".document-tile")).toHaveCount(4);
    await expect(results.getByRole("button", { name: /Planșe aprobate/ })).toBeVisible();
    await expect(results.getByRole("button", { name: "Planșe signed", exact: true })).toBeVisible();
    await expect(results.getByRole("button", { name: "Drawing", exact: true })).toBeVisible();
    await expect(results.getByRole("button", { name: "Plan outside", exact: true })).toHaveCount(0);
    await expect(
      results.getByText("Contractual documents / Archive / Signed documents", { exact: true }),
    ).toHaveCount(0);
    await expect(
      results.getByRole("button", { name: "Planșe signed", exact: true }),
    ).toHaveAttribute("title", "Contractual documents / Archive / Signed documents");
    await results
      .getByRole("button", { name: "Open location for Planșe signed", exact: true })
      .click();
    await expect(search).toHaveValue("");
    await expect(page.locator(".folder-breadcrumb")).toContainText("Signed documents");
    await search.fill("plan");
    await expect(results.locator(".document-tile")).toHaveCount(3);
    await expect(results.getByRole("button", { name: "Plan top", exact: true })).toHaveCount(0);
    await results.getByRole("button", { name: /Planșe aprobate/ }).click();
    await expect(search).toHaveValue("");
    await expect(page.locator(".folder-breadcrumb")).toContainText("Planșe aprobate");
    await expect(results.getByRole("button", { name: "Drawing", exact: true })).toBeVisible();
    await search.fill("does not exist");
    await expect(page.getByText("No results.", { exact: true })).toBeVisible();
    await search.clear();
    await page
      .locator(".folder-breadcrumb")
      .getByRole("button", { name: "Contractual documents", exact: true })
      .click();
    await expect(results.getByRole("button", { name: "Plan top", exact: true })).toBeVisible();
    if (role !== "Client") {
      await navigate("File Manager");
      await search.fill("plan");
      await expect(
        results.getByRole("button", { name: "Plan outside", exact: true }),
      ).toBeVisible();
      await search.clear();
      await page
        .locator(".shared-folder-row")
        .getByRole("button", { name: /Contractual documents/ })
        .click();
      await results.getByRole("button", { name: "Archive", exact: true }).click();
      await search.fill("plan");
      await expect(results.locator(".document-tile")).toHaveCount(3);
      await expect(results.getByRole("button", { name: "Plan outside", exact: true })).toHaveCount(
        0,
      );
      await expect(results.getByRole("button", { name: "Plan top", exact: true })).toHaveCount(0);
      await results.getByRole("button", { name: "Planșe signed", exact: true }).click();
      await expect(page.getByRole("dialog").locator("iframe")).toHaveAttribute(
        "src",
        "/api/projects/p1/files/nested/content?inline=true",
      );
      await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
      await page.getByLabel("Menu Planșe signed", { exact: true }).click();
      await page.getByRole("button", { name: "Rename", exact: true }).click();
      let dialog = page.getByRole("dialog", { name: "Rename Planșe signed" });
      await expect(dialog.getByRole("textbox", { name: "Name" })).toHaveValue("Planșe signed");
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByLabel("Menu Planșe signed", { exact: true })).toBeFocused();
      await page.getByLabel("Menu Planșe signed", { exact: true }).click();
      await page.getByRole("button", { name: "Rename", exact: true }).click();
      dialog = page.getByRole("dialog", { name: "Rename Planșe signed" });
      await dialog.getByRole("textbox", { name: "Name" }).fill("Plan signed revised");
      const renamed = page.waitForRequest(
        (req) => req.url().endsWith("/files/nested/name") && req.method() === "PUT",
      );
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      expect((await renamed).postDataJSON()).toEqual({ title: "Plan signed revised" });
      await expect(dialog).toHaveCount(0);
      await expect(
        results.getByRole("button", { name: "Plan signed revised", exact: true }),
      ).toBeVisible();
      await search.clear();
      await page
        .locator(".folder-breadcrumb")
        .getByRole("button", { name: "Contractual documents", exact: true })
        .click();
      await page.getByLabel("Menu Archive", { exact: true }).click();
      await page.getByRole("button", { name: "Rename", exact: true }).click();
      const folderDialog = page.getByRole("dialog", { name: "Rename folder Archive" });
      await expect(folderDialog.getByRole("textbox", { name: "Name" })).toHaveAttribute(
        "maxlength",
        "120",
      );
      await folderDialog.getByRole("textbox", { name: "Name" }).fill("Records");
      await folderDialog.getByRole("button", { name: "Save", exact: true }).click();
      await expect(folderDialog).toHaveCount(0);
      await results.getByRole("button", { name: "Records", exact: true }).click();
      await expect(page.locator(".folder-breadcrumb")).toContainText("Records");
      await expect(
        results.getByRole("button", { name: "Signed documents", exact: true }),
      ).toBeVisible();
      await search.fill("plan");
      await expect(
        results.getByRole("button", { name: "Plan signed revised", exact: true }),
      ).toHaveAttribute("title", "Records / Signed documents");
    }
  });
}
