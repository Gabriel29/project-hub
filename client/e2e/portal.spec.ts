import { expect, test } from "@playwright/test";

import { fixturePath, fulfillFixture } from "./resourceFixture";

// Browser zoom changes the effective CSS viewport; DPR alone does not test reflow.
for (const role of ["Client", "Owner"]) {
  test(`${role} workspace fills the screen and reflows at wide and zoomed viewport sizes`, async ({
    page,
  }, info) => {
    await mock(page, role);
    await page.route("**/api/projects/p1**", (route) =>
      fulfillFixture(route, {
        json: {
          project: { ...project, location: "București · " + "Adresă-lungă".repeat(12) },
          files: [],
          folders: [],
          sections: [],
          events: [],
          updates: Array.from({ length: 3 }, (_, i) => ({
            id: `responsive-${i}`,
            title: `Actualizare ${i}`,
            details: "Detalii despre proiect. ".repeat(100),
            occurredAt: "2026-10-14",
            photoIds: [],
            stageId: null,
          })),
        },
      }),
    );
    for (const width of [320, 480, 650, 750, 760, 761, 900, 1100, 1440, 1920, 2560, 3440]) {
      await test.step(`${width}px CSS viewport`, async () => {
        await page.setViewportSize({ width, height: width <= 900 ? 360 : 900 });
        await page.goto("/");
        await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
        const geometry = await page.getByRole("main").evaluate((el) => {
          const box = el.getBoundingClientRect();
          const heading = el.querySelector(".overview-heading")!.getBoundingClientRect();

          return {
            right: box.right,
            bottom: box.bottom,
            left: box.left,
            viewportHeight: innerHeight,
            width: box.width,
            headingWidth: heading.width,
            contentWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            scrollable: el.scrollHeight > el.clientHeight,
            bodyWidth: document.body.scrollWidth,
            sidebarWidth: document.querySelector(".sidebar")!.getBoundingClientRect().width,
          };
        });
        expect(geometry.right).toBeCloseTo(width, 0);
        expect(geometry.left).toBeCloseTo(width <= 760 ? 0 : geometry.sidebarWidth, 0);
        expect(geometry.bottom).toBeCloseTo(geometry.viewportHeight, 0);
        expect(geometry.width - geometry.headingWidth).toBeLessThanOrEqual(150);
        expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.clientWidth);
        expect(geometry.bodyWidth).toBe(width);
        expect(geometry.scrollable).toBe(true);
        await page.getByRole("main").evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        expect(await page.getByRole("main").evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
        expect((await page.locator(".topbar").boundingBox())!.y).toBe(0);
        await page.getByRole("main").evaluate((el) => {
          el.scrollTop = 0;
        });
        if ([480, 1920, 3440].includes(width)) {
          await page.screenshot({ path: info.outputPath(`responsive-${role}-${width}.png`) });
        }

        if (width <= 760) {
          await page.getByRole("button", { name: "Meniu", exact: true }).click();
        }

        const lastItem = page.locator(".sidebar nav button").last();
        await lastItem.scrollIntoViewIfNeeded();
        await expect(lastItem).toBeInViewport();
        await lastItem.click();
        await expect(lastItem).toHaveAttribute("aria-current", "page");
      });
    }
  });
}

const project = {
  id: "p1",
  clientId: "c1",
  name: "Residence ProjectHub",
  code: "QX-01",
  location: "București",
  stageId: "s1",
  description: "Un proiect construit cu precizie.",
  manager: "Andrei Popescu",
  managerPhone: "+40 721 234 567",
  clientContactName: "Client One",
  clientContactPhone: "+40 721 234 567",
  specifications: "Aluminiu și sticlă",
  warrantyYears: 5,
  updatedAt: "2026-10-13",
  milestones: ["Pregătire", "Execuție", "Recepție"].map((name, orderIndex) => ({
    id: `s${orderIndex + 1}`,
    name,
    orderIndex,
    description: `Descriere ${name}`,
  })),
};

async function mock(page: import("@playwright/test").Page, role = "Owner", noStages = false) {
  const currentProject = noStages ? { ...project, milestones: [], stageId: null } : project;
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const path = fixturePath(route.request().url(), route.request().method());
    const data = path.endsWith("/setup-status")
      ? { required: false }
      : path.endsWith("/me")
        ? {
            id: "u1",
            language: "ro",
            displayName: "Owner ProjectHub",
            email: "owner@example.test",
            roles: [role],
            hasPassword: true,
          }
        : path.endsWith("/clients")
          ? [
              {
                id: "c1",
                language: "ro",
                displayName: "Client One",
                email: "client@example.test",
              },
            ]
          : path.endsWith("/users")
            ? []
            : path === "/api/projects"
              ? [currentProject]
              : path === "/api/projects/p1"
                ? {
                    project: currentProject,
                    rootFolderId: role === "Client" ? null : "root",
                    files: [],
                    approvals: [],
                    events: [],
                    sections: [],
                    sections: [
                      {
                        key: "progress",
                        name: "Progres și foto",
                        clientVisible: true,
                        clientCanUpload: false,
                        canUpload: true,
                      },
                    ],
                    folders: [],
                    updates: [],
                  }
                : {};
    await fulfillFixture(route, { json: data });
  });
}

test("rail navigation, creation dialog, and responsive branding", async ({ page }, info) => {
  await mock(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Residence ProjectHub" })).toBeVisible();
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await expect(page.getByRole("img", { name: /ProjectHub/ })).toBeVisible();
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Închide meniul", exact: true }).click();
  }

  await page.getByRole("button", { name: "Creează proiect" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Client" })).toHaveValue("");
  await dialog.getByRole("combobox", { name: "Client" }).selectOption("none");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await page.locator("nav").getByRole("button", { name: "Manager fișiere", exact: true }).click();
  await expect(page.locator(".shared-folder-row .document-tile")).toHaveCount(5);
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.evaluate(() => innerWidth),
  );
  await page.screenshot({
    path: info.outputPath("portal.png"),
    fullPage: true,
    animations: "disabled",
  });
});
test("explicit logout returns to sign-in without a session-expired alert or protected refresh", async ({
  page,
}, info) => {
  await mock(page);
  let signedOut = false;
  const protectedRequests: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = fixturePath(route.request().url(), route.request().method());
    if (path === "/api/auth/logout") {
      expect(route.request().method()).toBe("POST");
      signedOut = true;

      return fulfillFixture(route, { status: 200, body: "" });
    }

    if (signedOut) {
      protectedRequests.push(path);

      return fulfillFixture(route, { status: 401, body: "" });
    }

    return route.fallback();
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
  await page.getByRole("button", { name: "Meniu cont" }).click();
  await page.getByRole("button", { name: "Deconectare", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(protectedRequests).toEqual([]);
  await page.screenshot({ path: info.outputPath("signed-out.png") });
});

test("client has one selector and no management button", async ({ page }, info) => {
  await mock(page, "Client");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Residence ProjectHub" })).toBeVisible();
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await expect(page.getByRole("combobox", { name: "Selectează proiectul" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Selectează clientul" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Creează proiect" })).toHaveCount(0);
});
test("activation clears secret and requires matching credentials", async ({ page }) => {
  await page.route(/^http:\/\/localhost:5173\/api\//, (route) =>
    fulfillFixture(route, {
      status: route.request().url().endsWith("/me") ? 401 : 200,
      json: route.request().url().endsWith("activation-details")
        ? {
            name: "Contact",
            language: "ro",
            email: "client@example.test",
            phoneNumber: "0722123456",
          }
        : { required: false },
    }),
  );
  await page.goto("/#activation=one-time-secret");
  await expect(page.getByRole("heading", { name: "Activate account" })).toBeVisible();
  await page.getByRole("button", { name: "Română", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Activează contul" })).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("client@example.test");
  await expect(page.getByLabel("Telefon")).toHaveValue("0722123456");
  await expect(page.getByLabel("Nume complet")).toHaveValue("Contact");
  await page.getByLabel("Parolă nouă", { exact: true }).fill("client1");
  await page.getByLabel("Confirmă parola").fill("client2");
  await page.getByRole("button", { name: "Salvează și continuă" }).click();
  await expect(page.getByRole("alert")).toHaveText("Parolele nu coincid.");
});

test("overview description, nested folders and stage activities", async ({ page }, info) => {
  await mock(page);
  const files = [
    {
      id: "f1",
      title: "Plan fațadă",
      folderId: "root",
      description: "",
      content: {
        id: "v1",
        fileName: "plan.pdf",
        contentType: "application/pdf",
        size: 2400000,
        createdAt: "2026-10-12T12:00:00Z",
        sha256: "",
      },
    },
  ];
  await page.route("**/api/projects/p1**", (route) =>
    fulfillFixture(route, {
      json: {
        project: {
          ...project,
          stageId: "s2",
          milestones: [
            {
              id: "s1",
              name: "Pregătire",
              orderIndex: 0,
              description: "Pregătirea proiectului",
            },
            {
              id: "s2",
              name: "Producție",
              orderIndex: 1,
              description: "Fabricarea elementelor proiectului",
            },
            {
              id: "s3",
              name: "Montaj",
              orderIndex: 2,
              description: "Instalarea elementelor",
            },
          ],
        },
        files,
        sections: [
          {
            key: "progress",
            name: "Progres și foto",
            clientVisible: true,
            clientCanUpload: false,
            canUpload: true,
          },
        ],
        folders: [
          { id: "root", name: "Root", parentId: null },
          { id: "folder1", name: "Contracte", parentId: "root" },
          { id: "nested", name: "Semnate", parentId: "folder1" },
        ],
        updates: [
          {
            stageId: "s2",
            id: "e1",
            title: "Profilele sunt în producție",
            details: "Echipa pregătește elementele pentru montaj.",
            occurredAt: "2026-10-12T12:00:00Z",
            photoContentId: null,
          },
        ],
        approvals: [
          {
            id: "a1",
            title: "Confirmă detaliile fațadei",
            details: "Consultă documentul",
            fileContentId: "v1",
            dueAt: null,
            resolvedAt: null,
            decision: null,
            signerName: null,
          },
        ],
        events: [],
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByText(project.description)).toBeVisible();
  await expect(page.locator(".overview-status")).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: "Producție" })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "+40 721 234 567" })).toHaveAttribute(
    "href",
    "tel:+40721234567",
  );
  await expect(page.getByRole("heading", { name: "Documente recente" })).toBeVisible();
  await expect(page.getByText("Profilele sunt în producție")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("overview.png"),
    fullPage: true,
  });
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await expect(page.locator("nav > button")).toHaveCount(9);
  await page.locator("nav").getByRole("button", { name: "Manager fișiere", exact: true }).click();
  await page.getByLabel("Meniu Plan fațadă").click();
  const move = page.waitForRequest(
    (req) => req.url().endsWith("/files/f1/folder") && req.method() === "PUT",
  );
  await page.getByRole("button", { name: "Mută", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Contracte", exact: true }).click();
  await page.getByRole("button", { name: "Mută aici" }).click();
  expect((await move).postDataJSON()).toEqual({ folderId: "folder1" });
  await page.getByRole("button", { name: /Contracte/ }).click();
  await expect(page.getByRole("button", { name: "Folder nou" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Semnate/ })).toBeVisible();
  await page.getByRole("button", { name: "Rădăcină" }).click();
  await expect(page.getByRole("button", { name: "Folder nou" })).toBeVisible();
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await page.locator("nav").getByRole("button", { name: "Progres și foto", exact: true }).click();
  await expect(page.getByRole("list", { name: "Etapele proiectului" })).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Activitățile proiectului" })
      .getByText("Profilele sunt în producție"),
  ).toBeVisible();
  await expect(page.locator(".current-step-note")).toHaveCount(0);
  expect(
    await page
      .locator(".activity-grid")
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length),
  ).toBe(1);
  await expect(page.getByRole("tab")).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("calendar.png"),
    fullPage: true,
  });
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await page.locator("nav").getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Producție" })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page.getByRole("button", { name: "Definește etapele" }).click();
  await page.getByRole("button", { name: "Mută etapa 3 mai sus" }).click();
  const stagesRequest = page.waitForRequest(
    (req) => req.url().endsWith("/stages") && req.method() === "PUT",
  );
  await page.getByRole("button", { name: "Salvează etapele" }).click();
  expect((await stagesRequest).postDataJSON().map((s: { name: string }) => s.name)).toEqual([
    "Pregătire",
    "Montaj",
    "Producție",
  ]);
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await page.locator("nav").getByRole("button", { name: "Progres și foto", exact: true }).click();
  await page.getByRole("button", { name: "Adaugă activitate" }).click();
  await page.getByRole("textbox", { name: "Titlu", exact: true }).fill("Noutate personalizată");
  await page
    .getByRole("textbox", { name: "Descriere activitate" })
    .fill("Stadiul proiectului descris de echipă.");
  const news = page.waitForRequest(
    (req) => req.url().endsWith("/updates") && req.method() === "POST",
  );
  await page.getByRole("button", { name: "Salvează activitatea" }).click();
  expect((await news).postDataJSON()).toMatchObject({
    title: "Noutate personalizată",
    photoContentId: null,
  });
});

test("image and PDF previews, multiple photos and warranty", async ({ page }, info) => {
  await mock(page);
  const content = (id: string, contentType: string) => ({
    id,
    contentType,
    fileName: id,
    size: 100,
    createdAt: "2026-10-13",
    sha256: "",
  });
  const files = [
    {
      id: "image",
      title: "Fotografie montaj",
      folderId: "progress",
      calendarPhoto: true,
      description: "",
      content: content("image-content", "image/png"),
    },
    {
      id: "pdf",
      title: "Plan PDF",
      folderId: "root",
      description: "",
      content: content("pdf-content", "application/pdf"),
    },
    {
      id: "photo2",
      title: "Detaliu montaj",
      folderId: "progress",
      calendarPhoto: true,
      description: "",
      content: content("photo2-content", "image/png"),
    },
  ];
  await page.route("**/api/projects/p1**", (route) =>
    fulfillFixture(route, {
      json: {
        project: {
          ...project,
          stageId: "s1",
          milestones: [{ id: "s1", name: "Montaj", orderIndex: 0, description: "" }],
        },
        files,
        sections: [
          {
            key: "progress",
            name: "Progres și foto",
            clientVisible: true,
            clientCanUpload: false,
            canUpload: true,
          },
        ],
        folders: [
          { id: "root", name: "Root", parentId: null },
          { id: "folder", name: "Contracte", parentId: "root" },
          {
            id: "progress",
            name: "Progres și foto",
            parentId: "root",
            sectionKey: "progress",
          },
        ],
        updates: [
          {
            id: "activity",
            title: "Galerie montaj",
            details: "Două fotografii",
            stageId: "s1",
            occurredAt: "2026-10-13",
            photoContentId: "image-content",
            photoIds: ["image-content", "photo2-content"],
          },
        ],
        approvals: [],
        events: [],
      },
    }),
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("**/files/*/content?inline=true", (route) =>
    fulfillFixture(route, {
      contentType: route.request().url().includes("/pdf/") ? "application/pdf" : "image/svg+xml",
      body: route.request().url().includes("/pdf/")
        ? Buffer.from("%PDF-1.7\n%%EOF")
        : Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#d7e5ec"/><path d="M0 560L300 240L600 500L880 160L1200 540V800H0Z" fill="#6f9392"/><circle cx="250" cy="160" r="70" fill="#f6c384"/></svg>'.replace(
              'width="1200" height="800"',
              route.request().url().includes("/photo2/")
                ? 'width="90" height="160"'
                : 'width="1200" height="800"',
            ),
          ),
    }),
  );
  const navigate = async (name: string) => {
    if (info.project.name === "mobile") {
      await page.getByRole("button", { name: "Meniu", exact: true }).click();
    }

    await page.locator("nav").getByRole("button", { name, exact: true }).click();
  };

  await page.goto("/");
  await navigate("Manager fișiere");
  await expect(page.locator(".document-tile .tile-open")).toHaveText([
    "Progres și foto",
    "Documente Contractuale",
    "Garanție & Utilizare",
    "Mentenanță & Intervenții",
    "Aprobări și documentații tehnice",
    "Contracte",
    "Plan PDF",
  ]);
  await expect(page.getByText(/\bMB\b|\bv\d+\b/)).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("documents.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Partajat cu clientul Progres și foto",
      exact: true,
    })
    .click();
  await expect(page.getByRole("button", { name: "Detaliu montaj", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fotografie montaj", exact: true }).click();
  await expect(page.getByRole("dialog").locator("img")).toHaveAttribute(
    "src",
    "/api/projects/p1/files/image/content?inline=true",
  );
  const filePhotoDialog = page.getByRole("dialog");
  await expect(filePhotoDialog.getByRole("link", { name: "Descarcă fotografia" })).toHaveAttribute(
    "href",
    "/api/projects/p1/files/image/content",
  );
  await expect(filePhotoDialog.getByRole("button", { name: "Fotografia următoare" })).toHaveCount(
    0,
  );
  await expect(filePhotoDialog.locator("h3")).toHaveCount(0);
  const filePhotoBounds = await filePhotoDialog.boundingBox();
  await page.screenshot({ path: info.outputPath("file-photo-preview.png") });
  await page.getByRole("button", { name: "Închide", exact: true }).click();
  await page.getByRole("button", { name: "Rădăcină", exact: true }).click();
  await page.getByRole("button", { name: "Plan PDF", exact: true }).click();
  await expect(page.getByRole("dialog").locator("iframe")).toHaveAttribute(
    "src",
    "/api/projects/p1/files/pdf/content?inline=true",
  );
  await page.getByRole("button", { name: "Închide", exact: true }).click();
  await page.getByLabel("Meniu Plan PDF").click();
  await expect(page.getByRole("button", { name: "Deschide", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Descarcă", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Șterge", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Fișierul va fi șters.");
  await page.getByRole("button", { name: "Anulează", exact: true }).click();
  await navigate("Dashboard");
  const dashboardPreview = page.getByRole("group", {
    name: "Fotografii: Galerie montaj",
  });
  await expect(dashboardPreview.locator("img")).toHaveCount(2);
  await expect(dashboardPreview.getByRole("button", { name: "Fotografia următoare" })).toHaveCount(
    0,
  );
  const dashboardOrder = await page
    .locator(".news-row > div")
    .evaluate((el) => Array.from(el.children).map((child) => child.tagName));
  expect(dashboardOrder).toEqual(["HEADER", "DIV", "P", "DIV"]);
  await dashboardPreview
    .getByRole("button", { name: "Deschide fotografia Detaliu montaj" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText("2 / 2");
  await expect(page.getByRole("dialog").locator("img")).toHaveAttribute("alt", "Detaliu montaj");
  await page.keyboard.press("Escape");
  await expect(
    dashboardPreview.getByRole("button", {
      name: "Deschide fotografia Detaliu montaj",
    }),
  ).toBeFocused();
  await navigate("Progres și foto");
  const preview = page.getByRole("group", {
    name: "Fotografii: Galerie montaj",
  });
  await expect(preview.locator("img")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Fotografia următoare" })).toHaveCount(0);
  await expect(page.locator(".stage-activities")).toHaveCSS("border-top-width", "0px");
  await expect(page.locator(".calendar-entry")).toHaveCSS("border-top-width", "1px");
  const order = await page
    .locator(".activity-body")
    .evaluate((el) => Array.from(el.children).map((child) => child.tagName));
  expect(order.slice(0, 4)).toEqual(["HEADER", "DIV", "P", "DIV"]);
  await preview.getByRole("button", { name: "Deschide fotografia Fotografie montaj" }).click();
  const carousel = page.getByRole("region", {
    name: "Galerie: Galerie montaj",
  });
  await expect(carousel.locator("img")).toHaveCount(1);
  await carousel.locator("img").evaluate((img: HTMLImageElement) => img.decode());
  const photoBounds = await page.getByRole("dialog").boundingBox();
  expect(photoBounds!.width).toBeCloseTo(filePhotoBounds!.width, 0);
  expect(photoBounds!.height).toBeCloseTo(filePhotoBounds!.height, 0);
  const imageBounds = await carousel.locator(".photo-viewer-image").boundingBox();
  await expect(carousel.getByRole("heading")).toHaveCount(0);
  await expect(carousel.locator(".photo-viewer-image .photo-download")).toBeVisible();
  await expect(carousel.getByRole("status")).toHaveText("1 / 2");
  await expect(carousel.getByRole("button", { name: "Fotografia precedentă" })).toBeDisabled();
  if (info.project.name === "mobile") {
    await carousel.locator("img").scrollIntoViewIfNeeded();
    const box = (await carousel.locator("img").boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box.x + box.width * 0.8, y: box.y + box.height * 0.5 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: box.x + box.width * 0.2, y: box.y + box.height * 0.5 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
    await expect(carousel.getByRole("status")).toHaveText("2 / 2");
    await carousel.getByRole("button", { name: "Fotografia precedentă" }).click();
  }

  await carousel.getByRole("button", { name: "Fotografia următoare" }).click();
  await expect(carousel.getByRole("status")).toHaveText("2 / 2");
  await carousel.locator("img").evaluate((img: HTMLImageElement) => img.decode());
  expect(await page.getByRole("dialog").boundingBox()).toEqual(photoBounds);
  expect(await carousel.locator(".photo-viewer-image").boundingBox()).toEqual(imageBounds);
  await expect(carousel.locator("img")).toHaveCSS("object-fit", "contain");
  await expect(carousel.getByRole("button", { name: "Fotografia următoare" })).toBeDisabled();
  await page.keyboard.press("ArrowLeft");
  await expect(carousel.locator("img")).toHaveAttribute("alt", "Fotografie montaj");
  await page.keyboard.press("End");
  await expect(carousel.locator("img")).toHaveAttribute("alt", "Detaliu montaj");
  await expect(carousel.getByRole("link", { name: "Descarcă fotografia" })).toHaveAttribute(
    "href",
    "/api/projects/p1/files/photo2/content",
  );
  await page.screenshot({
    path: info.outputPath("full-photo-carousel.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Editează activitatea" }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.locator(".attachment-editor img")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Șterge activitatea" })).toBeVisible();
  const update = page.waitForRequest(
    (req) => req.url().endsWith("/updates/activity") && req.method() === "PUT",
  );
  await page.getByRole("button", { name: "Salvează activitatea" }).click();
  expect((await update).postDataJSON().photoIds).toEqual(["image-content", "photo2-content"]);
  await page.getByRole("button", { name: "Adaugă activitate" }).click();
  await page.getByRole("textbox", { name: "Titlu", exact: true }).fill("Fotografii noi");
  await page.getByLabel("Adaugă fișiere (maximum 20 în total)").setInputFiles([
    { name: "prima.png", mimeType: "image/png", buffer: png },
    { name: "a-doua.png", mimeType: "image/png", buffer: png },
  ]);
  let uploads = 0;
  await page.route("**/api/projects/p1/files", (route) =>
    fulfillFixture(route, {
      json: { id: `new-${++uploads}`, contentId: `new-content-${uploads}` },
    }),
  );
  const post = page.waitForRequest(
    (req) => req.url().endsWith("/updates") && req.method() === "POST",
  );
  await page.getByRole("button", { name: "Salvează activitatea" }).click();
  expect((await post).postDataJSON().photoIds).toEqual(["new-content-1", "new-content-2"]);
  await navigate("Garanție & Utilizare");
  await expect(page.getByRole("heading", { name: "Garanție & Utilizare" })).toBeVisible();
  await expect(page.getByText("Niciun fișier aici")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("warranty.png"),
    fullPage: true,
  });
});

test("empty stages are hidden for clients and progress posting stays independent", async ({
  page,
}, info) => {
  await mock(page, "Client", true);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Etapele proiectului" })).toHaveCount(0);
  await expect(page.getByText("STATUS PROIECT", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Meniu cont" }).click();
  await expect(page.getByRole("button", { name: "Gestionare utilizatori" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Setări cont" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Meniu cont" })).toBeFocused();
  await mock(page, "Owner", true);
  await page.reload();
  await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Progres și foto", exact: true })
    .click();
  await page.getByRole("button", { name: "Adaugă activitate" }).click();
  await expect(page.getByLabel("Etapa proiectului (opțional)")).toHaveCount(0);
  await page.getByLabel("Titlu", { exact: true }).fill("Activitate fără etapă");
  const request = page.waitForRequest((r) => r.url().endsWith("/updates") && r.method() === "POST");
  await page.getByRole("button", { name: "Salvează activitatea" }).click();
  expect((await request).postDataJSON()).not.toHaveProperty("stageId");
});

test("account hamburger edits profile and creates separately labelled clients", async ({
  page,
}, info) => {
  await mock(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
  await expect(
    page.locator(".sidebar nav").getByRole("button", { name: "Utilizatori", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Meniu cont" }).click();
  await page.screenshot({ path: info.outputPath("account-menu.png") });
  await page.getByRole("button", { name: "Setări cont" }).click();
  await page.getByLabel("Nume complet").fill("Nume actualizat");
  await expect(page.getByLabel("Utilizator", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Datele contului" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const settingsBounds = await page.getByRole("dialog").boundingBox();
  await page.getByRole("tab", { name: "Securitate" }).click();
  await expect(page.getByRole("button", { name: "Salvează parola" })).toBeVisible();
  expect(await page.getByRole("dialog").boundingBox()).toEqual(settingsBounds);
  await page.getByRole("tab", { name: "Datele contului" }).click();
  expect(await page.getByRole("dialog").boundingBox()).toEqual(settingsBounds);
  await page.getByLabel("Parola curentă pentru salvarea datelor").scrollIntoViewIfNeeded();
  await expect(page.getByLabel("Parola curentă pentru salvarea datelor")).toBeInViewport();
  expect(await page.getByRole("dialog").boundingBox()).toEqual(settingsBounds);
  const tabBox = await page.getByRole("tablist").boundingBox();
  const panelBox = await page.getByRole("tabpanel").boundingBox();
  expect(tabBox!.x + tabBox!.width).toBeLessThan(panelBox!.x);
  await page.screenshot({ path: info.outputPath("account-settings.png") });
  await page.getByLabel("Email", { exact: true }).fill("updated@example.test");
  await page.getByLabel("Telefon", { exact: true }).fill("0722123456");
  await page.getByLabel("Parola curentă pentru salvarea datelor").fill("owner1");
  const profile = page.waitForRequest((r) => r.url().endsWith("/profile") && r.method() === "PUT");
  await page.getByRole("button", { name: "Salvează datele contului" }).click();
  expect((await profile).postDataJSON()).toMatchObject({
    name: "Nume actualizat",
    email: "updated@example.test",
    phoneNumber: "0722123456",
    currentPassword: "owner1",
  });
  await page.getByRole("button", { name: "Închide", exact: true }).click();
  await page.getByRole("button", { name: "Meniu cont" }).click();
  await page.getByRole("button", { name: "Gestionare utilizatori" }).click();
  await page.getByRole("button", { name: "Adaugă persoană" }).click();
  await page.getByLabel("Denumire client (pentru identificare)").fill("Vila Nord");
  await page.getByLabel("Nume complet").fill("Persoană contact");
  await page.getByLabel("Email", { exact: true }).fill("contact@example.test");
  await page.getByLabel("Telefon", { exact: true }).fill("0733123456");
  const invitation = page.waitForRequest(
    (r) => r.url().endsWith("/admin/users") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Creează contul" }).click();
  expect((await invitation).postDataJSON()).toMatchObject({
    clientName: "Vila Nord",
    name: "Persoană contact",
    email: "contact@example.test",
    phoneNumber: "0733123456",
    admin: false,
  });
});

test("activity photo previews cap at three and open all remaining photos in the dialog", async ({
  page,
}, info) => {
  await mock(page, "Client");
  const files = Array.from({ length: 6 }, (_, i) => ({
    id: `photo${i + 1}`,
    title: `Fotografie ${i + 1}`,
    folderId: "progress",
    description: "",
    calendarPhoto: true,
    content: {
      id: `content${i + 1}`,
      fileName: `${i + 1}.png`,
      contentType: "image/png",
      size: 100,
      createdAt: "2026-10-14",
      sha256: "",
    },
  }));
  await page.route("**/api/projects/p1**", (route) =>
    fulfillFixture(route, {
      json: {
        project,
        files,
        folders: [],
        sections: [],
        events: [],
        updates: [
          {
            id: "gallery",
            title: "Progres cu fotografii",
            details: "Descrierea înaintea fotografiilor",
            occurredAt: "2026-10-14",
            stageId: null,
            photoContentId: "content1",
            photoIds: files.map((f) => f.content.id),
          },
        ],
      },
    }),
  );
  await page.route("**/files/*/content?inline=true", (route) =>
    fulfillFixture(route, {
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.goto("/");
  const preview = page.getByRole("group", {
    name: "Fotografii: Progres cu fotografii",
  });
  await expect(page.getByText("ACTIVITĂȚI PROIECT", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Istoricul activităților" })).toHaveCount(0);

  await expect(page.locator(".progress-updates")).toHaveCSS("border-top-width", "1px");
  await expect(page.locator(".progress-updates")).toHaveCSS("border-radius", "14px");
  await page.locator(".progress-updates").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("dashboard-timeline.png"), fullPage: true });
  await expect(preview.locator("img")).toHaveCount(3);
  await expect(preview.getByText("+3", { exact: true })).toBeVisible();
  await expect(preview.getByText("6 fotografii · Deschide galeria")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fotografia următoare" })).toHaveCount(0);
  await preview
    .getByRole("button", {
      name: "Deschide fotografia Fotografie 3; încă 3 fotografii",
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("status")).toHaveText("3 / 6");
  await page.keyboard.press("End");
  await expect(dialog.locator("img")).toHaveAttribute("alt", "Fotografie 6");
  await expect(dialog.getByRole("status")).toHaveText("6 / 6");
  await page.keyboard.press("Home");
  await expect(dialog.getByRole("status")).toHaveText("1 / 6");
  await page.keyboard.press("Escape");
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Progres și foto", exact: true })
    .click();
  await expect(preview.locator("img")).toHaveCount(3);
  const typeSizes = await page.locator(".activity-body").evaluate((el) => ({
    title: parseFloat(getComputedStyle(el.querySelector("h3")!).fontSize),
    body: parseFloat(getComputedStyle(el.querySelector(".pre-text")!).fontSize),
  }));
  // Activity reading text follows the documented 15px --text-body token.
  expect(typeSizes.body).toBeGreaterThanOrEqual(15);
  expect(typeSizes.title).toBeGreaterThan(typeSizes.body);
  const bounds = await page.locator(".activity-body").evaluate((el) => ({
    text: el.querySelector("h3")!.getBoundingClientRect().left,
    photos: el.querySelector(".activity-photos")!.getBoundingClientRect().left,
    width: el.querySelector(".activity-photos")!.getBoundingClientRect().width,
  }));
  expect(bounds.text).toBe(bounds.photos);
  expect(bounds.width).toBeLessThanOrEqual(844);
  await expect(page.locator(".activity-post-full")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.getByRole("main").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({
    path: info.outputPath("photo-preview.png"),
    fullPage: true,
  });
});

test("copyright lives in the decorative rail and content uses the full viewport", async ({
  page,
}, info) => {
  await mock(page, "Client");
  await page.route("**/api/projects/p1**", (route) =>
    fulfillFixture(route, {
      json: {
        project,
        files: [],
        folders: [],
        sections: [],
        events: [],
        updates: Array.from({ length: 8 }, (_, i) => ({
          id: `post${i}`,
          title: `Actualizare ${i}`,
          details: "Descriere detaliată. ".repeat(100),
          occurredAt: "2026-10-14",
          stageId: null,
          photoIds: [],
          photoContentId: null,
        })),
      },
    }),
  );
  await page.goto("/");
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Garanție & Utilizare", exact: true })
    .click();
  await expect(page.locator(".workspace > footer")).toHaveCount(0);
  await expect(page.locator(".sidebar-footer")).toContainText(
    `© ${new Date().getFullYear()} ProjectHub`,
  );
  await expect(page.getByText("ProjectHub Client Portal", { exact: true })).toHaveCount(0);
  expect(
    await page.locator(".sidebar").evaluate((el) => getComputedStyle(el).backgroundImage),
  ).toContain("rail-grid.svg");
  const main = page.getByRole("main");
  expect((await main.boundingBox())!.y + (await main.boundingBox())!.height).toBeCloseTo(
    await page.evaluate(() => innerHeight),
    0,
  );
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Progres și foto", exact: true })
    .click();
  await expect(page.getByRole("article").nth(1)).toHaveCSS("border-top-width", "1px");
  await page.getByRole("main").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  expect((await main.boundingBox())!.y + (await main.boundingBox())!.height).toBeCloseTo(
    await page.evaluate(() => innerHeight),
    0,
  );
});

test("rail selectors have explicit styling and project editing opens a page", async ({
  page,
}, info) => {
  await mock(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Residence ProjectHub" })).toBeVisible();
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  for (const name of ["Selectează clientul", "Selectează proiectul"]) {
    const selector = page.getByRole("combobox", { name });
    await expect(selector).toBeVisible();
    await expect(selector).toHaveCSS("appearance", "none");
    await expect(selector).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(selector).toHaveCSS("color", "rgb(36, 33, 30)");
    await expect(selector).toHaveCSS("border-top-width", "1px");
    expect(await selector.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(
      "data:image/svg+xml",
    );
  }

  await page.getByRole("button", { name: "Editează proiectul", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Editează proiectul" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Denumire", exact: true })).toHaveValue(
    project.name,
  );
});

test("account type comes first and switching to admin preserves dialog size", async ({
  page,
}, info) => {
  await mock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Meniu cont" }).click();
  await page.getByRole("button", { name: "Gestionare utilizatori" }).click();
  await page.getByRole("button", { name: "Adaugă persoană" }).click();
  const dialog = page.getByRole("dialog");
  const type = dialog.getByRole("combobox");
  await expect(dialog.locator("form input, form select").first()).toHaveJSProperty(
    "tagName",
    "SELECT",
  );
  const initialBounds = await dialog.boundingBox();
  await type.selectOption("admin");
  expect(await dialog.boundingBox()).toEqual(initialBounds);
  await expect(dialog.locator('input[name="clientName"]')).toBeDisabled();
  await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
  await dialog.getByLabel("Nume complet").fill("Administrator invitat");
  await dialog.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.screenshot({ path: info.outputPath("admin-invitation.png") });
  await type.selectOption("client");
  expect(await dialog.boundingBox()).toEqual(initialBounds);
  await expect(dialog.getByLabel("Denumire client (pentru identificare)")).toBeEnabled();
  await type.selectOption("admin");
  const invitation = page.waitForRequest(
    (r) => r.url().endsWith("/admin/users") && r.method() === "POST",
  );
  await dialog.getByRole("button", { name: "Creează contul" }).click();
  expect((await invitation).postDataJSON()).toEqual({
    admin: true,
    name: "Administrator invitat",
    email: "admin@example.test",
    phoneNumber: "",
  });
});
