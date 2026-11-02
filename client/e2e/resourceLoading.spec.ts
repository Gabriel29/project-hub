import { expect, test } from "@playwright/test";

for (const role of ["Owner", "Client"]) {
  test(`${role} loads only the active folder through split APIs`, async ({ page }, info) => {
    const requests: string[] = [];
    const folder = (
      id: string,
      parentId: string | null,
      name: string,
      sectionKey: string | null = null,
    ) => ({
      id,
      parentId,
      name,
      sectionKey,
      clientVisible: id !== "root",
      clientCanUpload: false,
      canUpload: role === "Owner",
      imagesOnly: false,
    });
    const root = folder("root", null, "Root");
    const contracts = folder(
      "contracts",
      role === "Owner" ? "root" : null,
      ".contracts",
      "contracts",
    );
    const child = folder("child", "contracts", "Child folder");
    const project = {
      id: "p1",
      name: "Lazy project",
      code: "LP-1000",
      milestones: [],
      description: "",
      manager: "Manager",
      managerPhone: "",
      nextMaintenanceDate: null,
    };
    const file = (id: string, folderId: string, title: string) => ({
      id,
      folderId,
      title,
      content: {
        id,
        fileName: `${id}.pdf`,
        contentType: "application/pdf",
        size: 10,
        createdAt: "2026-10-18",
        sha256: "",
      },
    });
    await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
      const path = new URL(route.request().url()).pathname;
      requests.push(path);
      const data = path.endsWith("/setup-status")
        ? { required: false }
        : path.endsWith("/me")
          ? { id: role, roles: [role], language: "en", displayName: role, hasPassword: true }
          : path === "/api/projects"
            ? [project]
            : path.endsWith("/clients")
              ? []
              : path === "/api/projects/p1"
                ? { project, rootFolderId: role === "Owner" ? "root" : null }
                : path.endsWith("/sections")
                  ? [
                      {
                        key: "contracts",
                        folderId: "contracts",
                        name: ".contracts",
                        canUpload: role === "Owner",
                      },
                    ]
                  : path.endsWith("/activities")
                    ? { updates: [], files: [] }
                    : path.endsWith("/recent-documents")
                      ? { files: [], folders: [] }
                      : path.endsWith("/folders/contracts/contents")
                        ? {
                            folder: contracts,
                            breadcrumbs: [contracts],
                            folders: [child],
                            files: [file("direct", "contracts", "Direct contract")],
                            paths: [],
                          }
                        : path.endsWith("/folders/child/contents")
                          ? {
                              folder: child,
                              breadcrumbs: [contracts, child],
                              folders: [],
                              files: [file("nested", "child", "Nested contract")],
                              paths: [],
                            }
                          : path.endsWith("/folders/root/contents") && role === "Owner"
                            ? {
                                folder: root,
                                breadcrumbs: [root],
                                folders: [contracts],
                                files: [],
                                paths: [],
                              }
                            : null;
      if (data === null) {
        return route.fulfill({ status: 404, json: { code: "notFound" } });
      }

      return route.fulfill({ json: data });
    });
    const navigate = async (name: string) => {
      if (info.project.name === "mobile") {
        await page.getByRole("button", { name: "Menu", exact: true }).click();
      }

      await page.locator("nav").getByRole("button", { name, exact: true }).click();
    };

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Lazy project" })).toBeVisible();
    expect(requests.filter((path) => path.includes("/folders/"))).toEqual([]);
    await navigate("Contractual documents");
    await expect(page.getByRole("button", { name: "Direct contract", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nested contract", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Child folder", exact: true }).click();
    await expect(page.getByRole("button", { name: "Nested contract", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Direct contract", exact: true })).toHaveCount(0);
    await page
      .locator(".folder-breadcrumb")
      .getByRole("button", { name: "Contractual documents", exact: true })
      .click();
    await expect(page.getByRole("button", { name: "Direct contract", exact: true })).toBeVisible();
    if (role === "Owner") {
      await navigate("File Manager");
      await expect(
        page.locator(".document-tile").getByRole("button", { name: /Contractual documents/ }),
      ).toBeVisible();
      expect(requests).toContain("/api/projects/p1/folders/root/contents");
    } else {
      expect(requests).not.toContain("/api/projects/p1/folders/root/contents");
    }
  });
}
