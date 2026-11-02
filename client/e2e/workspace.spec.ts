import { expect, type Page, test, type TestInfo } from "@playwright/test";

import { fixturePath, fulfillFixture } from "./resourceFixture";

async function fixture(
  page: Page,
  role = "Owner",
  fullDefaults = false,
  nextMaintenanceDate: string | null = null,
) {
  const project = {
    id: "p1",
    code: "QX-1000",
    name: "Proiect cu documente partajate",
    location: "București",
    description: "Un spațiu clar pentru fiecare etapă a proiectului.",
    manager: "Andrei Popescu",
    managerPhone: "+40 721 234 567",
    managerUserId: "owner",
    clientId: "c1",
    stageId: "s1",
    nextMaintenanceDate,
    updatedAt: "2026-10-14T10:00:00Z",
    milestones: [
      {
        id: "s1",
        name: "Pregătire",
        description: "Documente și planificare",
        orderIndex: 0,
      },
      {
        id: "s2",
        name: "Montaj",
        description: "Instalarea elementelor",
        orderIndex: 1,
      },
    ],
  };
  const folders = [
    { id: "root", name: "Root", parentId: null, sectionKey: null },
    {
      id: "contracts",
      name: "Documente Contractuale",
      parentId: "root",
      sectionKey: "contracts",
      clientVisible: true,
    },
    {
      id: "nested",
      name: "Documente semnate",
      parentId: "contracts",
      sectionKey: null,
      clientVisible: true,
    },
    {
      id: "maintenance",
      name: "Mentenanță & Intervenții",
      parentId: "root",
      sectionKey: "maintenance",
      clientVisible: true,
    },
  ];
  const policies = [
    {
      key: "progress",
      name: "Progres și foto",
      clientVisible: true,
      clientCanUpload: false,
      canUpload: role !== "Client",
      imagesOnly: true,
    },
    {
      key: "contracts",
      name: "Documente Contractuale",
      clientVisible: true,
      clientCanUpload: false,
      canUpload: role !== "Client",
    },
    {
      key: "warranty",
      name: "Garanție & Utilizare",
      clientVisible: true,
      clientCanUpload: false,
      canUpload: role !== "Client",
    },
    {
      key: "maintenance",
      name: "Mentenanță & Intervenții",
      clientVisible: true,
      clientCanUpload: false,
      canUpload: role !== "Client",
    },
    {
      key: "technical",
      name: "Aprobări și documentații tehnice",
      clientVisible: true,
      clientCanUpload: false,
      canUpload: role !== "Client",
    },
  ];
  const files = [
    {
      id: "contract",
      title: "Contract semnat",
      folderId: "nested",
      description: "",
      calendarPhoto: false,
      content: {
        id: "content1",
        fileName: "contract.pdf",
        contentType: "application/pdf",
        size: 200,
        createdAt: "2026-10-14T10:00:00Z",
        sha256: "test",
      },
    },
    {
      id: "report",
      title: "Raport de intervenție",
      folderId: "maintenance",
      description: "",
      calendarPhoto: false,
      content: {
        id: "content2",
        fileName: "report.pdf",
        contentType: "application/pdf",
        size: 200,
        createdAt: "2026-10-14T10:00:00Z",
        sha256: "test",
      },
    },
  ];
  if (fullDefaults) {
    files.push({
      ...files[0],
      id: "certificate",
      title: "Certificat de garanție",
      folderId: "certificates",
    });
    files.push({
      ...files[0],
      id: "progress-photo",
      title: "Fotografie pregătire",
      folderId: "progress",
      calendarPhoto: true,
      content: {
        ...files[0].content,
        id: "progress-content",
        fileName: "photo.png",
        contentType: "image/png",
      },
    });
    folders.push({
      id: "progress",
      name: "Progres și foto",
      parentId: "root",
      sectionKey: "progress",
    });
    folders.unshift({
      id: "private",
      name: "Arhivă internă",
      parentId: "root",
      sectionKey: null,
    });
    folders.push({
      id: "technical",
      name: "Aprobări și documentații tehnice",
      parentId: "root",
      sectionKey: "technical",
    });
    folders.push({
      id: "certificates",
      name: "Certificate",
      parentId: "warranty",
      sectionKey: null,
    });
    folders.push({
      id: "warranty",
      name: "Garanție & Utilizare",
      parentId: "root",
      sectionKey: "warranty",
    });
    files.push({
      ...files[0],
      id: "internal",
      title: "Buget intern",
      folderId: "root",
    });
  }

  let notes: {
    id: string;
    title: string;
    body: string;
    createdAt: string;
    updatedAt: string;
  }[] = [];
  await page.route(/\/api\/(?:auth|projects|admin|clients)(?:[/?]|$)/, async (route) => {
    const req = route.request();
    const path = fixturePath(req.url(), req.method());
    const method = req.method();
    if (path.endsWith("setup-status")) {
      return fulfillFixture(route, { json: { required: false } });
    }

    if (path.endsWith("/me")) {
      return fulfillFixture(route, {
        json: {
          id: "owner",
          language: "ro",
          displayName: role,
          roles: [role],
          hasPassword: true,
        },
      });
    }

    if (path.endsWith("/clients")) {
      return fulfillFixture(route, { json: [{ id: "c1", language: "ro", displayName: "Client" }] });
    }

    if (path.endsWith("/users")) {
      return fulfillFixture(route, {
        json: [{ id: "owner", language: "ro", displayName: "Owner", roles: ["Owner"] }],
      });
    }

    if (path === "/api/projects") {
      return fulfillFixture(route, { json: [project] });
    }

    if (path.match(/\/notes(?:\/[^/]+)?$/)) {
      if (method === "POST") {
        notes.push({
          id: "note1",
          ...req.postDataJSON(),
          createdAt: "2026-10-14T10:00:00Z",
          updatedAt: "2026-10-14T10:00:00Z",
        });
      }

      if (method === "PUT") {
        notes = notes.map((n) => ({ ...n, ...req.postDataJSON() }));
      }

      if (method === "DELETE") {
        notes = [];
      }

      return method === "GET"
        ? fulfillFixture(route, { json: notes })
        : fulfillFixture(route, { status: 200, body: "" });
    }

    if (path.endsWith("/maintenance-date") && method === "PUT") {
      project.nextMaintenanceDate = req.postDataJSON().date;

      return fulfillFixture(route, { json: {} });
    }

    if (path.endsWith("/files/folders") && method === "POST") {
      const request = req.postDataJSON();
      folders.push({
        id: `created-${folders.length}`,
        name: request.name,
        parentId: request.parentId,
        sectionKey: null,
      });

      return fulfillFixture(route, { status: 200, body: "" });
    }

    if (path.endsWith("/files") && method === "POST") {
      return fulfillFixture(route, {
        json: { id: "uploaded", contentId: "uploaded-content" },
      });
    }

    if (path.endsWith("/content")) {
      return fulfillFixture(route, {
        contentType: "application/pdf",
        body: "%PDF-1.7\n%%EOF",
      });
    }

    if (path === "/api/projects/p1") {
      return fulfillFixture(route, {
        json: {
          project,
          rootFolderId: role === "Client" ? null : "root",
          files,
          sections: policies,
          folders: role === "Client" ? folders.filter((f) => f.id !== "root") : folders,
          updates: [],
          events: [],
        },
      });
    }

    return fulfillFixture(route, { status: 200, body: "" });
  });
}

async function navigate(page: Page, info: TestInfo, name: string) {
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Meniu", exact: true }).click();
  }

  await page.locator("nav").getByRole("button", { name, exact: true }).click();
}

test("client browses shared folders while all five sections reject upload controls", async ({
  page,
}, info) => {
  await fixture(page, "Client");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Proiect cu documente partajate" })).toBeVisible();
  await expect(page.locator("nav").getByRole("button", { name: "Manager fișiere" })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Deschide fila Documente Contractuale pentru Contract semnat" })
    .click();
  await expect(page.locator(".folder-breadcrumb")).toContainText("Documente semnate");
  await expect(page.getByRole("button", { name: "Contract semnat", exact: true })).toBeVisible();
  for (const name of [
    "Progres și foto",
    "Documente Contractuale",
    "Garanție & Utilizare",
    "Mentenanță & Intervenții",
    "Aprobări și documentații tehnice",
  ]) {
    await navigate(page, info, name);
    await expect(page.getByRole("button", { name: "Încarcă fișier", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Folder nou", exact: true })).toHaveCount(0);
  }

  await navigate(page, info, "Documente Contractuale");
  await page.getByRole("button", { name: "Documente semnate", exact: true }).click();
  await expect(page.getByRole("button", { name: "Contract semnat", exact: true })).toBeVisible();
  await expect(page.locator(".folder-breadcrumb")).toContainText("Documente semnate");
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.evaluate(() => innerWidth),
  );
});

test("owner keeps private project notes and maintenance documents", async ({ page }, info) => {
  await fixture(page);
  await page.goto("/");
  await navigate(page, info, "Manager fișiere");
  const shared = page.getByRole("button", {
    name: "Partajat cu clientul Documente Contractuale",
    exact: true,
  });
  await expect(shared).toBeVisible();
  await expect(page.getByLabel("Meniu Documente Contractuale")).toHaveCount(0);
  await navigate(page, info, "Notițe");
  await expect(page.getByText("Nicio notiță încă")).toBeVisible();
  await page.getByRole("button", { name: "Notiță nouă", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Titlu", { exact: true }).fill("Observații interne");
  await dialog.getByLabel("Notiță", { exact: true }).fill("Detalii private pentru proiect.");
  await dialog.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Observații interne" })).toBeVisible();
  await page.getByLabel("Meniu Observații interne", { exact: true }).click();
  await page.getByRole("button", { name: "Editează", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Notiță", exact: true }).fill("Text actualizat.");
  await dialog.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(page.getByText("Text actualizat.")).toBeVisible();
  await page.screenshot({ path: info.outputPath("notes.png"), fullPage: true });
  await page.getByLabel("Meniu Observații interne", { exact: true }).click();
  await page.getByRole("button", { name: "Șterge", exact: true }).click();
  await dialog.getByRole("button", { name: "Anulează" }).click();
  await expect(page.getByText("Text actualizat.")).toBeVisible();
  await page.getByLabel("Meniu Observații interne", { exact: true }).click();
  await page.getByRole("button", { name: "Șterge", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmă ștergerea" }).click();
  await expect(page.getByText("Nicio notiță încă")).toBeVisible();
  await navigate(page, info, "Mentenanță & Intervenții");
  await expect(page.getByRole("heading", { name: "Istoricul intervențiilor" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Raport de intervenție", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".maintenance-notice")).toHaveCount(0);
});

test("admin has file management, notes and maintenance documents", async ({ page }, info) => {
  await fixture(page, "Admin");
  await page.goto("/");
  await navigate(page, info, "Notițe");
  await expect(page.getByRole("button", { name: "Notiță nouă", exact: true })).toBeVisible();
  await navigate(page, info, "Mentenanță & Intervenții");
  await expect(page.getByRole("button", { name: "Adaugă intervenție", exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Folder nou", exact: true })).toBeVisible();
  await navigate(page, info, "Manager fișiere");
  await expect(page.getByRole("button", { name: "Folder nou", exact: true })).toBeVisible();
  await expect(page.locator(".folder-breadcrumb")).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicită aprobare" })).toHaveCount(0);
  await navigate(page, info, "Aprobări și documentații tehnice");
  await expect(
    page.getByRole("heading", { name: "Aprobări și documentații tehnice" }),
  ).toBeVisible();
  await expect(page.getByText("Niciun fișier aici")).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.evaluate(() => innerWidth),
  );
});

test("default folders wrap above private content and use separate icon colors", async ({
  page,
}, info) => {
  await fixture(page, "Owner", true);
  await page.goto("/");
  await navigate(page, info, "Manager fișiere");
  const row = page.getByRole("group", {
    name: "Folderele implicite ale proiectului",
  });
  await expect(row.locator(".tile-open")).toHaveText([
    "Progres și foto",
    "Documente Contractuale",
    "Garanție & Utilizare",
    "Mentenanță & Intervenții",
    "Aprobări și documentații tehnice",
  ]);
  const ordinary = page.locator(".folder-grid.document-tiles");
  await expect(ordinary.locator(".tile-open")).toHaveText(["Arhivă internă", "Buget intern"]);
  const positions = await row
    .locator(".document-tile")
    .evaluateAll((tiles) => tiles.map((tile) => tile.getBoundingClientRect().top));
  expect(new Set(positions).size).toBeGreaterThan(1);
  const rowBox = await row.boundingBox();
  const privateBox = await ordinary.boundingBox();
  expect(privateBox!.y).toBeGreaterThanOrEqual(rowBox!.y + rowBox!.height);
  const defaultIcon = row.locator(".tile-open svg").first();
  await expect(defaultIcon).toHaveCSS("color", "rgb(212, 97, 25)");
  await expect(ordinary.locator('[data-kind="folder"] .tile-open svg')).toHaveCSS(
    "color",
    "rgb(220, 160, 84)",
  );
  await expect(ordinary.locator('[data-kind="file"] .tile-open svg')).toHaveCSS(
    "color",
    "rgb(107, 114, 128)",
  );
  expect(privateBox!.y - (rowBox!.y + rowBox!.height)).toBeGreaterThanOrEqual(24);
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.evaluate(() => innerWidth),
  );
  await page.screenshot({
    path: info.outputPath("shared-first-row.png"),
    fullPage: true,
  });
  await row
    .getByRole("button", {
      name: "Partajat cu clientul Documente Contractuale",
      exact: true,
    })
    .click();
  await expect(page.getByRole("button", { name: "Documente semnate", exact: true })).toBeVisible();
  await expect(row).toHaveCount(0);
});

test("warranty folders and descendants remain visible and read-only to clients", async ({
  page,
}, info) => {
  await fixture(page, "Client", true);
  await page.goto("/");
  await navigate(page, info, "Garanție & Utilizare");
  await expect(page.getByRole("button", { name: "Încarcă fișier", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Certificate", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Certificate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Certificat de garanție", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Încarcă fișier", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Folder nou", exact: true })).toHaveCount(0);
  await page.getByLabel("Meniu Certificat de garanție").click();
  await expect(page.getByRole("link", { name: "Descarcă", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mută", exact: true })).toBeDisabled();
  await page.screenshot({
    path: info.outputPath("client-read-only-warranty.png"),
    fullPage: true,
  });
});

test("progress photos are visible in File Manager and upload uses server image policy", async ({
  page,
}, info) => {
  await fixture(page, "Admin", true);
  await page.goto("/");
  await navigate(page, info, "Manager fișiere");
  await page
    .getByRole("button", {
      name: "Partajat cu clientul Progres și foto",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Fotografie pregătire", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Încarcă fișier", exact: true }).click();
  await expect(page.getByRole("dialog").locator('input[type="file"]')).toHaveAttribute(
    "accept",
    ".png,.jpg,.jpeg,.webp",
  );
  await page.getByRole("button", { name: "Închide", exact: true }).click();
  await navigate(page, info, "Garanție & Utilizare");
  await expect(page.getByRole("button", { name: "Încarcă fișier", exact: true })).toBeVisible();
  await navigate(page, info, "Progres și foto");
  await page.getByRole("button", { name: "Adaugă activitate", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Folosește fotografia/ })).toHaveCount(0);
});

test("optional next maintenance is displayed on dashboard and maintenance tab", async ({
  page,
}, info) => {
  await fixture(page, "Owner", false, "2027-04-15");
  await page.goto("/");
  await expect(page.locator(".maintenance-summary")).toContainText("15 aprilie 2027");
  expect(
    await page
      .locator(".overview-summary > section")
      .evaluateAll((elements) => elements.map((el) => el.className)),
  ).toEqual([
    "summary-box project-description",
    "summary-box maintenance-summary",
    "summary-box manager-contact",
  ]);
  await navigate(page, info, "Editează proiectul");
  await expect(page.getByRole("heading", { name: "Editează proiectul" })).toBeVisible();
  await expect(page.getByLabel("Următoarea mentenanță (opțional)")).toHaveCount(0);
  await navigate(page, info, "Mentenanță & Intervenții");
  await expect(page.locator(".maintenance-notice")).toHaveText(
    "Următoarea mentenanță: 15 aprilie 2027",
  );
  const update = page.getByRole("button", { name: "Actualizează mentenanța" });
  await expect(page.locator(".page-heading")).toContainText("Actualizează mentenanța");
  await expect(page.getByLabel("Data următoarei mentenanțe (opțional)")).toHaveCount(0);
  await update.click();
  const dialog = page.getByRole("dialog", { name: "Actualizează mentenanța" });
  await expect(dialog.getByLabel("Data următoarei mentenanțe (opțional)")).toHaveValue(
    "2027-04-15",
  );
  await dialog.getByLabel("Data următoarei mentenanțe (opțional)").fill("2027-05-15");
  const saved = page.waitForRequest(
    (r) => r.url().endsWith("/maintenance-date") && r.method() === "PUT",
  );
  await page.getByRole("button", { name: "Salvează data", exact: true }).click();
  expect((await saved).postDataJSON()).toEqual({ date: "2027-05-15" });
  await expect(page.locator(".maintenance-notice")).toHaveText(
    "Următoarea mentenanță: 15 mai 2027",
  );
  await expect(dialog).toHaveCount(0);
  await update.click();
  await dialog.getByLabel("Data următoarei mentenanțe (opțional)").fill("");
  await page.getByRole("button", { name: "Salvează data", exact: true }).click();
  await expect(page.locator(".maintenance-notice")).toHaveCount(0);
  await navigate(page, info, "Dashboard");
  await expect(page.locator(".maintenance-summary")).toContainText("URMĂTOAREA MENTENANȚĂ");
  await expect(page.locator(".maintenance-summary")).toContainText(
    "Data următoarei mentenanțe nu a fost stabilită.",
  );
  await expect(
    page.getByText("Lucrări de mentenanță și intervenții publicate de echipă."),
  ).toHaveCount(0);
});

for (const role of ["Owner", "Admin", "Client"]) {
  test(`${role} maintenance date permissions`, async ({ page }, info) => {
    await fixture(page, role, false, "2027-04-15");
    await page.goto("/");
    await navigate(page, info, "Mentenanță & Intervenții");
    await expect(page.locator(".maintenance-notice")).toContainText("15 aprilie 2027");
    const update = page.getByRole("button", { name: "Actualizează mentenanța" });
    if (role === "Client") {
      await expect(update).toHaveCount(0);
      await expect(page.getByLabel("Data următoarei mentenanțe (opțional)")).toHaveCount(0);

      return;
    }

    await update.click();
    const dialog = page.getByRole("dialog", { name: "Actualizează mentenanța" });
    await dialog.getByLabel("Data următoarei mentenanțe (opțional)").fill("2028-01-01");
    await dialog.getByRole("button", { name: "Salvează data", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".maintenance-notice")).toContainText("1 ianuarie 2028");
    await update.click();
    await dialog.getByLabel("Data următoarei mentenanțe (opțional)").fill("");
    await dialog.getByRole("button", { name: "Salvează data", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".maintenance-notice")).toHaveCount(0);
  });
}

for (const role of ["Owner", "Admin"]) {
  test(`${role} creates category folders and uploads into them across all five sections`, async ({
    page,
  }, info) => {
    test.setTimeout(60_000);
    await fixture(page, role, true);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Proiect cu documente partajate" }),
    ).toBeVisible();
    const sections = [
      ["progress", "Progres și foto"],
      ["contracts", "Documente Contractuale"],
      ["warranty", "Garanție & Utilizare"],
      ["maintenance", "Mentenanță & Intervenții"],
      ["technical", "Aprobări și documentații tehnice"],
    ];
    for (const [key, name] of sections) {
      await navigate(page, info, name);
      if (key === "progress") {
        await expect(page.getByRole("button", { name: "Încarcă fișier", exact: true })).toHaveCount(
          0,
        );
        continue;
      }

      await expect(page.getByRole("button", { name: "Încarcă fișier", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Folder nou", exact: true }).click();
      const dialog = page.getByRole("dialog");
      const folderName = `Folder local ${key}`;
      await dialog.getByLabel("Denumire folder").fill(folderName);
      const created = page.waitForRequest(
        (req) => req.url().endsWith("/files/folders") && req.method() === "POST",
      );
      await dialog.getByRole("button", { name: "Creează folder", exact: true }).click();
      expect((await created).postDataJSON()).toMatchObject({ parentId: key, sectionKey: key });
      await expect(dialog).toHaveCount(0);
      await page.getByRole("button", { name: folderName, exact: true }).click();
      await expect(page.locator(".folder-breadcrumb")).toContainText(folderName);
      await page.getByRole("button", { name: "Încarcă fișier", exact: true }).click();
      await dialog.getByLabel("Denumire document / fotografie").fill(`Document ${key}`);
      await dialog.locator('input[type="file"]').setInputFiles({
        name: "photo.png",
        mimeType: "image/png",
        buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
      });
      const uploaded = page.waitForRequest(
        (req) => req.url().endsWith("/files") && req.method() === "POST",
      );
      await dialog.getByRole("button", { name: "Încarcă fișier", exact: true }).click();
      const body = (await uploaded).postData()!;
      expect(body).toContain(`name="sectionKey"\r\n\r\n${key}`);
      expect(body).toMatch(/name="folderId"\r\n\r\ncreated-/);
      await expect(dialog).toHaveCount(0);
      await navigate(page, info, "Manager fișiere");
      await page.getByRole("button", { name: `Partajat cu clientul ${name}`, exact: true }).click();
      await expect(page.getByRole("button", { name: folderName, exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Folder nou", exact: true })).toBeVisible();
    }
  });
}

test("note previews keep equal size and open complete long content", async ({ page }, info) => {
  await fixture(page);
  const body = "Detalii despre instalare și documentație. ".repeat(350);
  await page.route("**/api/projects/p1/notes", (route) =>
    fulfillFixture(route, {
      json: [
        {
          id: "short",
          title: "Mesaj scurt",
          body: "Confirmăm programarea pentru luni.",
          updatedAt: "2026-10-16",
        },
        {
          id: "long",
          title:
            "Notiță detaliată cu un titlu foarte lung pentru verificarea previzualizării fără modificarea dimensiunii cardului",
          body,
          updatedAt: "2026-10-16",
        },
      ],
    }),
  );
  await page.goto("/");
  await navigate(page, info, "Notițe");
  await expect(page.locator(".note-card")).toHaveCount(2);
  const cards = page.locator(".note-card");
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(first?.height).toBe(248);
  expect(second?.height).toBe(first?.height);
  expect(second!.width).toBeCloseTo(first!.width, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("notes-long-preview.png"), fullPage: true });
  await cards.nth(1).locator(".note-preview").click();
  await expect(page.getByRole("dialog").locator(".note-full-body")).toHaveText(body);
  await page.keyboard.press("Escape");
  await expect(cards.nth(1).locator(".note-preview")).toBeFocused();
});
