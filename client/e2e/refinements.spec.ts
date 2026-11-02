import { expect, type Page, test } from "@playwright/test";

import { fixturePath, fulfillFixture } from "./resourceFixture";

const project = (id: string, clientId: string | null = null) => ({
  id,
  clientId,
  name: `Project ${id}`,
  code: id,
  description: "Details",
  location: "București",
  manager: "Owner",
  managerPhone: "",
  managerUserId: "u1",
  stageId: null,
  milestones: [],
  updatedAt: "2026-10-15",
});
const files = Array.from({ length: 7 }, (_, i) => ({
  id: `file${i}`,
  title: `Document ${i}`,
  folderId: i === 0 ? "progress" : "contracts",
  content: {
    id: `content${i}`,
    fileName:
      i === 0 ? "photo.png" : i === 1 ? "contract.pdf" : i === 2 ? "report.docx" : "data.xlsx",
    contentType: i === 0 ? "image/png" : i === 1 ? "application/pdf" : "application/octet-stream",
    createdAt: `2026-10-${10 + i}`,
    size: 10,
    sha256: "",
  },
  description: "",
}));

async function fixture(page: Page) {
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = fixturePath(req.url(), req.method());
    const data = path.endsWith("setup-status")
      ? { required: false }
      : path.endsWith("/me")
        ? {
            id: "u1",
            language: "ro",
            displayName: "Owner",
            roles: ["Owner"],
            email: "owner@test.local",
          }
        : path.endsWith("/clients")
          ? [
              { id: "c1", language: "ro", displayName: "Client One" },
              { id: "c2", language: "ro", displayName: "Client Two" },
            ]
          : path.endsWith("/users")
            ? [
                {
                  id: "u1",
                  language: "ro",
                  displayName: "Owner",
                  roles: ["Owner"],
                  disabled: false,
                },
              ]
            : path.endsWith("/search")
              ? [
                  { kind: "project", id: "p3", name: "Target project", clientId: "c2", code: "p3" },
                  { kind: "client", id: "c1", name: "Client One", clientId: "c1", code: "C1" },
                ]
              : path === "/api/projects"
                ? url.searchParams.get("clientId") === "c2"
                  ? [project("p2", "c2"), project("p3", "c2")]
                  : url.searchParams.get("clientId") === "c1"
                    ? [project("p4", "c1")]
                    : [project("p1")]
                : /\/projects\/p\d$/.test(path)
                  ? {
                      project: project(
                        path.split("/").pop()!,
                        path.endsWith("p3") || path.endsWith("p2")
                          ? "c2"
                          : path.endsWith("p4")
                            ? "c1"
                            : null,
                      ),
                      files,
                      folders: [
                        {
                          id: "progress",
                          parentId: "root",
                          sectionKey: "progress",
                          name: "Progres și foto",
                          clientVisible: true,
                        },
                        {
                          id: "contracts",
                          parentId: "root",
                          sectionKey: "contracts",
                          name: ".contracts",
                          clientVisible: true,
                        },
                      ],
                      sections: [],
                      events: [],
                      updates: [
                        {
                          id: "activity",
                          title: "Montaj",
                          details: "Update",
                          occurredAt: "2026-10-15",
                          photoIds: ["content0"],
                          photoContentId: "content0",
                        },
                      ],
                    }
                  : path.endsWith("/notes")
                    ? [
                        {
                          id: "note",
                          title: "Observații",
                          body: "Details",
                          updatedAt: "2026-10-15",
                        },
                      ]
                    : path.endsWith("/files") && req.method() === "POST"
                      ? { id: "new", contentId: "new-content" }
                      : {};
    await fulfillFixture(route, { json: data });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Project p1", exact: true })).toBeVisible();
}

async function navigate(page: Page, name: string) {
  if (await page.getByRole("button", { name: "Meniu", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await page.locator(".sidebar nav").getByRole("button", { name, exact: true }).click();
}

test("search selects the owning client and exact project, then clears", async ({ page }) => {
  await fixture(page);
  await navigate(page, "Notițe");
  if (await page.getByRole("button", { name: "Meniu", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  const input = page.getByLabel("Caută client sau cod");
  await input.fill("Target");
  await page.getByRole("button", { name: /Target project/ }).click();
  await expect(page.getByRole("heading", { name: "Project p3", exact: true })).toBeVisible();
  await expect(page.getByLabel("Selectează clientul")).toHaveValue("c2");
  await expect(page.getByLabel("Selectează proiectul")).toHaveValue("p3");
  await expect(input).toHaveValue("");
  if (await page.getByRole("button", { name: "Meniu", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await input.fill("Client");
  await page.getByRole("button", { name: /Client One/ }).click();
  await expect(page.getByRole("heading", { name: "Project p4", exact: true })).toBeVisible();
  await expect(page.getByLabel("Selectează clientul")).toHaveValue("c1");
  await expect(input).toHaveValue("");
});
test("six recent documents, equal project controls, and note menu", async ({ page }, info) => {
  await fixture(page);
  await expect(page.locator(".recent-document-link")).toHaveCount(6);
  await expect(page.locator(".recent-document-link").first()).toContainText("Document 6");
  await navigate(page, "Editează proiectul");
  for (const label of ["Client", "Manager proiect"]) {
    await expect(page.getByRole("combobox", { name: label, exact: true })).toHaveCSS(
      "height",
      "44px",
    );
  }

  for (const label of ["Denumire", "Locație"]) {
    await expect(page.getByRole("textbox", { name: label, exact: true })).toHaveCSS(
      "height",
      "44px",
    );
  }

  await navigate(page, "Notițe");
  await expect(page.getByRole("heading", { name: "Observații", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editează", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Meniu Observații", exact: true }).click();
  await expect(page.getByRole("button", { name: "Editează", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("note-actions.png") });
});
test("activity attachments accumulate, can be removed, and deletion is confirmed", async ({
  page,
}) => {
  await fixture(page);
  await navigate(page, "Progres și foto");
  await expect(
    page.locator(".activity-title-row").getByRole("button", { name: "Editează activitatea" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editează activitatea" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("listbox")).toHaveCount(0);
  await expect(dialog.locator(".attachment-preview")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Elimină Document 0" }).click();
  const input = dialog.getByLabel("Adaugă fișiere (maximum 20 în total)");
  await input.setInputFiles({
    name: "first.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("PDF"),
  });
  await input.setInputFiles({
    name: "second.docx",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("DOCX"),
  });
  await expect(dialog.locator(".attachment-preview")).toHaveCount(2);
  await dialog.getByRole("button", { name: "Elimină first.pdf" }).click();
  const saved = page.waitForRequest(
    (r) => r.url().endsWith("/updates/activity") && r.method() === "PUT",
  );
  await dialog.getByRole("button", { name: "Salvează activitatea" }).click();
  expect((await saved).postDataJSON().photoIds).toEqual(["new-content"]);
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Editează activitatea" }).click();
  await dialog.getByRole("button", { name: "Șterge activitatea" }).click();
  await expect(
    dialog.getByText("Ștergi această activitate? Fișierele rămân în Manager fișiere."),
  ).toBeVisible();
  const deleted = page.waitForRequest(
    (r) => r.url().endsWith("/updates/activity") && r.method() === "DELETE",
  );
  await dialog.getByRole("button", { name: "Confirmă ștergerea" }).click();
  await deleted;
  await expect(dialog).toHaveCount(0);
});

test("document search highlights the whole box including the icon", async ({ page }) => {
  await fixture(page);
  await navigate(page, "Documente Contractuale");
  const search = page.locator(".search");
  const input = search.getByRole("textbox");
  const idleBorder = await search.evaluate((el) => getComputedStyle(el).borderColor);
  await search.locator("svg").click();
  await expect(input).toBeFocused();
  await expect(search).toHaveCSS("border-color", "rgb(223, 73, 0)");
  await expect(search).not.toHaveCSS("box-shadow", "none");
  await expect(input).toHaveCSS("box-shadow", "none");
  await expect(input).toHaveCSS("border-top-width", "0px");
  await expect(search.locator("svg")).toBeVisible();
  await input.fill("Document");
  await input.press("Tab");
  await expect(search).toHaveCSS("border-color", idleBorder);
  await expect(search).toHaveCSS("box-shadow", "none");
});
