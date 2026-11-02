import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { App } from "../app/App";
import { LanguageFlags } from "../components/LanguageFlags";
import i18n, { normalizeLanguage, setLanguage, t } from "../i18n";
import en from "../i18n/locales/en.json";
import ro from "../i18n/locales/ro.json";
import { date } from "../logic/format";
import { folderLabel } from "../logic/navigation";
import { api } from "../services/api/http";
import type { Folder } from "../types/portal";
import { splitApiMock } from "./splitApiFixture";

beforeEach(() => setLanguage("en"));
afterEach(() => vi.unstubAllGlobals());
it.each([undefined, null, "", "fr", "RO", "en", 12])(
  "defaults unsupported preference %s to English",
  (value) => {
    expect(normalizeLanguage(value)).toBe("en");
  },
);
it("keeps the catalogs complete and interpolation tokens consistent", () => {
  expect(Object.keys(ro).sort()).toEqual(Object.keys(en).sort());
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    expect(ro[key]).not.toBe("");
    expect(ro[key].match(/{{\w+}}/g)?.sort()).toEqual(en[key].match(/{{\w+}}/g)?.sort());
  }
});
it.each(["en", "ro"] as const)(
  "uses saved %s preference on the signed-in portal",
  async (language) => {
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn(
          async (input: string) =>
            new Response(
              JSON.stringify(
                input.endsWith("setup-status")
                  ? { required: false }
                  : input.endsWith("/me")
                    ? { id: "user", language, displayName: "Ana", roles: ["Client"] }
                    : [],
              ),
            ),
        ),
      ),
    );
    render(<App />);
    await screen.findByRole("button", {
      name: language === "ro" ? "Progres și foto" : "Progress and photos",
    });
    expect(document.documentElement.lang).toBe(language);
    expect(
      screen.getByText(language === "ro" ? "Bine ai venit, Ana" : "Welcome, Ana"),
    ).toBeVisible();
  },
);
it("switches labels without losing input, and formats dates in the active language", async () => {
  render(<LanguageFlags />);
  await userEvent.click(screen.getByRole("button", { name: "Română" }));
  expect(screen.getByRole("button", { name: "Română" })).toHaveAttribute("aria-pressed", "true");
  expect(date("2026-02-10")).toContain("feb.");
  await act(async () => setLanguage("en"));
  expect(date("2026-02-10")).toContain("Feb");
});
it("maps storage folders by section key and leaves user folder names intact", () => {
  const folder = { name: ".maintanance", parentId: "root", sectionKey: "maintenance" } as Folder;
  expect(folderLabel(folder)).toBe("Maintenance & Interventions");
  setLanguage("ro");
  expect(folderLabel(folder)).toBe("Mentenanță & Intervenții");
  expect(folderLabel({ ...folder, sectionKey: null, name: "My documents" })).toBe("My documents");
});
it("localizes API errors and keeps the login fallback specific", async () => {
  vi.stubGlobal(
    "fetch",
    splitApiMock(
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "Parola curentă este incorectă." }), {
            status: 400,
          }),
      ),
    ),
  );
  await expect(api("/auth/profile")).rejects.toThrow("Incorrect current password.");
  vi.stubGlobal("fetch", splitApiMock(vi.fn(async () => new Response("", { status: 401 }))));
  await expect(api("/auth/login")).rejects.toThrow("Incorrect email or password.");
  setLanguage("ro");
  await expect(api("/auth/login")).rejects.toThrow("Email sau parolă incorectă.");
});
it("uses language-specific plural rules and English translation fallback", () => {
  expect(t("search.results", { count: 1 })).toBe("1 suggestion");
  setLanguage("ro");
  expect(t("search.results", { count: 1 })).toBe("1 sugestie");
  expect(t("search.results", { count: 2 })).toBe("2 sugestii");
  expect(t("search.results", { count: 20 })).toBe("20 de sugestii");
  i18n.addResource("en", "translation", "test.fallback", "English fallback");
  expect(i18n.t("test.fallback")).toBe("English fallback");
});
it.each(["en", "ro"] as const)(
  "sign-in flags do not overwrite the saved %s account language",
  async (savedLanguage) => {
    let signedIn = false;
    let loginBody: unknown;
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn(async (input: string, init?: RequestInit) => {
          if (input.endsWith("/login")) {
            loginBody = JSON.parse(init!.body as string);
            signedIn = true;

            return new Response("");
          }

          if (input.endsWith("setup-status")) {
            return new Response(JSON.stringify({ required: false }));
          }

          if (input.endsWith("/me")) {
            return signedIn
              ? new Response(
                  JSON.stringify({
                    id: "user",
                    displayName: "Ana",
                    language: savedLanguage,
                    roles: ["Client"],
                  }),
                )
              : new Response("", { status: 401 });
          }

          return new Response("[]");
        }),
      ),
    );
    render(<App />);
    await screen.findByRole("heading", { name: "Welcome" });
    expect(screen.queryByLabelText("Preferred language")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Email"), "ana@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "client1");
    // Deliberately select the opposite page language to the account's preference.
    if (savedLanguage === "en") {
      await userEvent.click(screen.getByRole("button", { name: "Română" }));
    }

    await userEvent.click(
      screen.getByRole("button", { name: savedLanguage === "en" ? "Autentificare" : "Sign in" }),
    );
    await screen.findByText(savedLanguage === "ro" ? "Bine ai venit, Ana" : "Welcome, Ana");
    expect(loginBody).toEqual({ email: "ana@example.test", password: "client1" });
    expect(document.documentElement.lang).toBe(savedLanguage);
  },
);
it("activation starts in English and saves its separate preference regardless of flags", async () => {
  history.replaceState(null, "", "/#activation=secret");
  let submitted: Record<string, unknown> = {};
  vi.stubGlobal(
    "fetch",
    splitApiMock(
      vi.fn(async (input: string, init?: RequestInit) => {
        if (input.endsWith("setup-status")) {
          return new Response(JSON.stringify({ required: false }));
        }

        if (input.endsWith("activation-details")) {
          return new Response(
            JSON.stringify({ name: "Ana", email: "ana@example.test", language: "ro" }),
          );
        }

        if (input.endsWith("/activate")) {
          submitted = JSON.parse(init!.body as string);

          return new Response("{}", { status: 400 });
        }

        return new Response("", { status: 401 });
      }),
    ),
  );
  render(<App />);
  await screen.findByRole("heading", { name: "Activate account" });
  expect(document.documentElement.lang).toBe("en");
  expect(screen.getByLabelText("Preferred language")).toHaveValue("en");
  await userEvent.selectOptions(screen.getByLabelText("Preferred language"), "ro");
  expect(document.documentElement.lang).toBe("en");
  await userEvent.click(screen.getByRole("button", { name: "Română" }));
  expect(screen.getByLabelText("Limba preferată")).toHaveValue("ro");
  await userEvent.click(screen.getByRole("button", { name: "English" }));
  await userEvent.type(screen.getByLabelText("New password"), "client1");
  await userEvent.type(screen.getByLabelText("Confirm password"), "client1");
  await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(submitted).toMatchObject({ language: "ro", token: "secret" });
  expect(document.documentElement.lang).toBe("en");
  history.replaceState(null, "", "/");
});

it("uses stable semantic keys in both catalogs", () => {
  for (const key of Object.keys(en)) {
    expect(key).toMatch(/^[a-z]+\.[a-zA-Z]+(?:_(?:one|few|other))?$/);
  }
});

it("translates each API validation error before combining the messages", async () => {
  vi.stubGlobal(
    "fetch",
    splitApiMock(
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              errors: { email: ["Email invalid."], password: ["Parola curentă este incorectă."] },
            }),
            { status: 400 },
          ),
      ),
    ),
  );
  await expect(api("/auth/profile")).rejects.toThrow("Invalid email. Incorrect current password.");
});

it("preserves unknown server messages", async () => {
  vi.stubGlobal(
    "fetch",
    splitApiMock(
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              message: "A new server message",
            }),
            { status: 400 },
          ),
      ),
    ),
  );
  await expect(api("/example")).rejects.toThrow("A new server message");
});
