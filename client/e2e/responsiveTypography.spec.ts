import { expect, test } from "@playwright/test";

import { fixturePath, fulfillFixture } from "./resourceFixture";

for (const language of ["en", "ro"]) {
  test(`System typography stays readable and compact from small phones to QHD and 4K in ${language}`, async ({
    page,
  }, info) => {
    const fontRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") {
        fontRequests.push(request.url());
      }
    });
    const project = {
      id: "p1",
      name: "Lakeview Residence",
      code: "LV-1000",
      location: "București",
      description: "Project details, installation updates, and documents in one place. ".repeat(3),
      manager: "Andrei Popescu",
      managerPhone: "+40 721 234 567",
      milestones: [],
      clientId: "c1",
      clientContactName: "Maria Ionescu",
      clientContactEmail: "maria@example.test",
      updatedAt: "2026-10-16",
      nextMaintenanceDate: "2027-04-15",
    };
    await page.route(/^http:\/\/localhost:5173\/api\//, (route) => {
      const path = fixturePath(route.request().url(), route.request().method());

      return fulfillFixture(route, {
        json: path.endsWith("setup-status")
          ? { required: false }
          : path.endsWith("/me")
            ? { id: "owner", displayName: "Gabriel Ionescu", roles: ["Owner"], language }
            : path === "/api/projects"
              ? [project]
              : path === "/api/projects/p1"
                ? { project, files: [], folders: [], sections: [], updates: [], events: [] }
                : [],
      });
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: project.name, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(
      /^system-ui,/,
    );
    expect(await page.evaluate(() => document.fonts.size)).toBe(0);
    expect(fontRequests).toEqual([]);
    for (const [name, width, height] of [
      ["small", 320, 568],
      ["mobile", 390, 844],
      ["laptop", 1366, 768],
      ["qhd", 2560, 1440],
      ["4k", 3840, 2160],
    ] as const) {
      await page.setViewportSize({ width, height });
      const sizes = await page.evaluate(() => {
        const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const content = document.querySelector(".main-content")!;

        return {
          root,
          body: parseFloat(getComputedStyle(document.body).fontSize),
          reading: parseFloat(
            getComputedStyle(document.querySelector(".project-description p")!).fontSize,
          ),
          nav: parseFloat(
            getComputedStyle(document.querySelector(".sidebar nav button")!).fontSize,
          ),
          contentOverflow: content.scrollWidth > content.clientWidth + 1,
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(sizes.root).toBeCloseTo(16, 1);
      expect(sizes.body).toBe(13);
      expect(sizes.reading).toBe(15);
      expect(sizes.nav).toBe(13);
      expect(sizes.contentOverflow).toBe(false);
      expect(sizes.pageOverflow).toBe(false);
      if (width < 761) {
        expect((await page.locator(".topbar").boundingBox())!.height).toBeLessThanOrEqual(80);
        const menu = page.getByRole("button", {
          name: language === "en" ? "Menu" : "Meniu",
          exact: true,
        });
        await expect(menu).toHaveText(language === "en" ? "Menu" : "Meniu");
        await expect(menu).toHaveAttribute("aria-expanded", "false");
        const touchTarget = await menu.boundingBox();
        expect(touchTarget!.height).toBeGreaterThanOrEqual(44);
        await menu.click();
        await expect(menu).toHaveAttribute("aria-expanded", "true");
        await expect(page.locator("#main-navigation")).toBeVisible();
        await expect(page.locator("#main-navigation")).toHaveCSS(
          "transform",
          "matrix(1, 0, 0, 1, 0, 0)",
        );
        await page.screenshot({
          path: info.outputPath(`${language}-${name}-menu.png`),
          fullPage: true,
        });
        await page
          .getByRole("button", {
            name: language === "en" ? "Close menu" : "Închide meniul",
            exact: true,
          })
          .click();
      }

      await page.screenshot({ path: info.outputPath(`${language}-${name}.png`), fullPage: true });
    }

    // Text enlargement is independent of monitor resolution and device pixel ratio.
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const enlarged = await page.evaluate(() => ({
      root: parseFloat(getComputedStyle(document.documentElement).fontSize),
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
      contentOverflow:
        document.querySelector(".main-content")!.scrollWidth >
        document.querySelector(".main-content")!.clientWidth + 1,
    }));
    expect(enlarged.root).toBe(32);
    expect(enlarged.pageOverflow).toBe(false);
    const overflowDetails = await page.locator(".main-content").evaluate((main) =>
      Array.from(main.querySelectorAll("*"))
        .filter((el) => el.getBoundingClientRect().right > main.getBoundingClientRect().right + 1)
        .map((el) => ({
          tag: el.tagName,
          className: el.className,
          text: el.textContent?.slice(0, 60),
        }))
        .slice(0, 15),
    );
    expect(enlarged.contentOverflow, JSON.stringify(overflowDetails)).toBe(false);
    await page.screenshot({ path: info.outputPath(`${language}-text-200.png`), fullPage: true });
    expect(fontRequests).toEqual([]);
  });
}
