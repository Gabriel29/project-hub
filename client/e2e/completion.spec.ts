import { expect, test } from "@playwright/test";

import { fixturePath, fulfillFixture } from "./resourceFixture";

for (const language of ["en", "ro"]) {
  test(`final stage state marks all stages completed in ${language}`, async ({ page }, info) => {
    let stagesCompleted = false;
    let stageId: string | null = "s1";
    let milestones = [
      { id: "s1", name: "Preparation", orderIndex: 0, description: "", stageComplete: false },
      { id: "s2", name: "Installation", orderIndex: 1, description: "", stageComplete: false },
    ];
    await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
      const path = fixturePath(route.request().url(), route.request().method());
      if (path.endsWith("/status")) {
        const body = route.request().postDataJSON();
        stagesCompleted = body.stagesCompleted;
        stageId = body.stageId;
        const current = milestones.findIndex((m) => m.id === stageId);
        milestones = milestones.map((m, index) => ({
          ...m,
          stageComplete: stagesCompleted || index < current,
        }));

        return fulfillFixture(route, { status: 200, body: "" });
      }

      return fulfillFixture(route, {
        json: path.endsWith("setup-status")
          ? { required: false }
          : path.endsWith("/me")
            ? { id: "owner", displayName: "Ana", language, roles: ["Owner"] }
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
                        milestones,
                        stageId,
                        stagesCompleted,
                      },
                      folders: [],
                      files: [],
                      sections: [],
                      updates: [],
                      events: [],
                    }
                  : [],
      });
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: language === "en" ? "Update status" : "Actualizează stadiul" })
      .click();
    const selector = page.getByRole("combobox", {
      name: language === "en" ? "Current stage" : "Etapă curentă",
    });
    await expect(selector.locator("option").last()).toHaveText(
      language === "en" ? "All stages completed" : "Toate etapele finalizate",
    );
    await selector.selectOption("completed");
    await page
      .getByRole("button", { name: language === "en" ? "Save status" : "Salvează stadiul" })
      .click();
    const stages = page.getByRole("list", {
      name: language === "en" ? "Project stages" : "Etapele proiectului",
    });
    await expect(
      stages.getByText(language === "en" ? "Completed" : "Finalizată", { exact: true }),
    ).toHaveCount(2);
    await expect(stages.locator(".stage-number.complete")).toHaveCount(2);
    await expect(stages.locator('[aria-current="step"]')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`completed-${language}.png`), fullPage: true });
    await page.reload();
    await expect(stages.locator(".stage-number.complete")).toHaveCount(2);
    await page
      .getByRole("button", { name: language === "en" ? "Update status" : "Actualizează stadiul" })
      .click();
    await expect(selector).toHaveValue("completed");
    await selector.selectOption("s2");
    await page
      .getByRole("button", { name: language === "en" ? "Save status" : "Salvează stadiul" })
      .click();
    await expect(stages.locator(".stage-number.complete")).toHaveCount(1);
    await expect(
      stages.getByText(language === "en" ? "In progress" : "În desfășurare", { exact: true }),
    ).toHaveCount(1);
    await page
      .getByRole("button", {
        name: language === "en" ? "Define stages" : "Definește etapele",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        language === "en"
          ? "Added automatically at the end of the status list."
          : "Adăugat automat la finalul listei de stări.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: language === "en" ? "Stage 3 name" : "Denumire etapă 3" }),
    ).toHaveCount(0);
  });
}
