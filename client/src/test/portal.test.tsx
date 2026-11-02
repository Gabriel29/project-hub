import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../app/App";
import { Modal } from "../components/Modal";
import { splitApiMock } from "./splitApiFixture";

const project = (id: string, name: string) => ({
  id,
  name,
  code: id,
  location: "București",
  stageId: "s1",
  updatedAt: "2026-10-13",
  clientId: "c1",
  description: "",
  manager: "Andrei Popescu",
  managerPhone: "+40 721 234 567",
  managerEmail: "manager@example.test",
  clientContactName: "Maria Ionescu",
  clientContactEmail: "maria@example.test",
  clientContactPhone: "+40 722 345 678",
  specifications: "",
  warrantyYears: 5,
  milestones: ["Pregătire", "Execuție", "Recepție"].map((name, orderIndex) => ({
    id: `s${orderIndex + 1}`,
    name,
    orderIndex,
    description: `Descriere ${name}`,
  })),
});
const response = (data: unknown, status = 200) =>
  new Response(data === undefined ? "" : JSON.stringify(data), { status });
let roles = ["Owner"];
let requests: { path: string; body: unknown }[] = [];
beforeEach(() => {
  requests = [];
  roles = ["Owner"];
  history.replaceState(null, "", "/");
  vi.stubGlobal(
    "fetch",
    splitApiMock(
      vi.fn(async (input: string, init?: RequestInit) => {
        const path = String(input);
        const body =
          init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
        requests.push({ path, body });
        if (path.endsWith("setup-status")) {
          return response({ required: false });
        }

        if (path.endsWith("/me")) {
          return response({
            id: "u1",
            email: "owner@test.local",
            language: "ro",
            displayName: "Owner",
            roles,
            hasPassword: true,
          });
        }

        if (path.endsWith("/clients")) {
          return response([
            { id: "c1", language: "ro", displayName: "Client", email: "client@test.local" },
          ]);
        }

        if (path.endsWith("/users")) {
          return response([
            { id: "u1", language: "ro", displayName: "Owner", roles: ["Owner"], disabled: false },
          ]);
        }

        if (path.match(/\/projects\/?(\?|$)/)) {
          if (init?.method === "POST") {
            return response({ id: "p1" });
          }

          return response([project("p1", "Vila One"), project("p2", "Vila Two")]);
        }

        if (path.includes("/projects/p")) {
          return response({
            project: project(
              path.endsWith("p2") ? "p2" : "p1",
              path.endsWith("p2") ? "Vila Two" : "Vila One",
            ),
            files: [],
            approvals: [],
            events: [],
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
          });
        }

        return response(undefined);
      }),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("portal", () => {
  it.each(["Owner", "Admin", "Client"])(
    "%s gets the correct upload and folder controls in all five sections",
    async (role) => {
      roles = [role];
      const originalFetch = fetch;
      const sections = [
        ["progress", "Progres și foto"],
        ["contracts", "Documente Contractuale"],
        ["warranty", "Garanție & Utilizare"],
        ["maintenance", "Mentenanță & Intervenții"],
        ["technical", "Aprobări și documentații tehnice"],
      ];
      vi.stubGlobal(
        "fetch",
        splitApiMock(
          vi.fn(async (input: string, init?: RequestInit) => {
            if (input !== "/api/projects/p1") {
              return originalFetch(input, init);
            }

            return response({
              project: project("p1", "Vila One"),
              events: [],
              updates: [],
              sections: sections.map(([key]) => ({ key, canUpload: true })),
              folders: [
                { id: "root", name: "Root", parentId: null, sectionKey: null, canUpload: true },
                ...sections.flatMap(([key]) => [
                  { id: key, name: `.${key}`, parentId: "root", sectionKey: key, canUpload: true },
                  {
                    id: `${key}-child`,
                    name: `Folder ${key}`,
                    parentId: key,
                    sectionKey: null,
                    canUpload: true,
                  },
                ]),
              ],
              files: sections.map(([key]) => ({
                id: `${key}-file`,
                title: `Document ${key}`,
                folderId: `${key}-child`,
                calendarPhoto: key === "progress",
                content: {
                  id: key,
                  fileName: `${key}.pdf`,
                  contentType: "application/pdf",
                  createdAt: "2026-10-16",
                },
              })),
            });
          }),
        ),
      );
      render(<App />);
      await screen.findByRole("heading", { name: "Vila One" });
      for (const [key, label] of sections) {
        await userEvent.click(screen.getByRole("button", { name: label }));
        if (key === "progress") {
          expect(screen.queryByRole("button", { name: "Încarcă fișier" })).not.toBeInTheDocument();
          expect(screen.queryByRole("button", { name: `Folder ${key}` })).not.toBeInTheDocument();
          expect(screen.queryByRole("button", { name: `Document ${key}` })).not.toBeInTheDocument();
          continue;
        }

        expect(screen.queryByRole("button", { name: `Document ${key}` })).not.toBeInTheDocument();
        if (role === "Client") {
          expect(screen.queryByRole("button", { name: "Încarcă fișier" })).not.toBeInTheDocument();
          expect(screen.queryByRole("button", { name: "Folder nou" })).not.toBeInTheDocument();
        } else {
          expect(screen.getByRole("button", { name: "Încarcă fișier" })).toBeVisible();
          expect(screen.getByRole("button", { name: "Folder nou" })).toBeVisible();
        }

        await userEvent.click(screen.getByRole("button", { name: `Folder ${key}` }));
        expect(screen.getByRole("button", { name: `Document ${key}` })).toBeVisible();
        expect(document.querySelector(".folder-breadcrumb")).toHaveTextContent(label);
      }

      if (role !== "Client") {
        await userEvent.click(screen.getByRole("button", { name: "Manager fișiere" }));
        expect(screen.getByRole("button", { name: "Încarcă fișier" })).toBeVisible();
        expect(screen.getByRole("button", { name: "Folder nou" })).toBeVisible();
      }
    },
  );

  it("preserves activation tokens through Strict Mode and sends them on submit", async () => {
    history.replaceState(null, "", "/#activation=strict-token");
    const originalFetch = fetch;
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn(async (input: string, init?: RequestInit) => {
          if (input.endsWith("activation-details")) {
            requests.push({ path: input, body: JSON.parse(init!.body as string) });

            return response({ name: "Contact", email: "contact@example.test", phoneNumber: null });
          }

          if (input.endsWith("/me")) {
            return response({}, 401);
          }

          if (input.endsWith("/activate")) {
            requests.push({ path: input, body: JSON.parse(init!.body as string) });

            return response({ message: "Validation failed" }, 400);
          }

          return originalFetch(input, init);
        }),
      ),
    );
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Română" }));
    await screen.findByRole("heading", { name: "Activează contul" });
    expect(location.hash).toBe("");
    expect(requests.filter((r) => r.path.endsWith("activation-details"))).toEqual(
      expect.arrayContaining([expect.objectContaining({ body: { token: "strict-token" } })]),
    );
    expect(
      requests
        .filter((r) => r.path.endsWith("activation-details"))
        .every((r) => (r.body as { token: string }).token === "strict-token"),
    ).toBe(true);
    await userEvent.type(screen.getByLabelText("Parolă nouă"), "client1");
    await userEvent.type(screen.getByLabelText("Confirmă parola"), "client1");
    await userEvent.click(screen.getByRole("button", { name: "Salvează și continuă" }));
    await waitFor(() =>
      expect(requests.find((r) => r.path.endsWith("/activate"))?.body).toMatchObject({
        token: "strict-token",
        email: "contact@example.test",
      }),
    );
  });

  it("keeps the saved project manager selected when people arrive after the form mounts", async () => {
    const originalFetch = fetch;
    let releasePeople!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn(async (input: string, init?: RequestInit) => {
          if (input === "/api/admin/users") {
            return new Promise<Response>((resolve) => {
              releasePeople = resolve;
            });
          }

          const result = await originalFetch(input, init);
          if (input === "/api/projects/p1") {
            const detail = await result.json();

            return response({ ...detail, project: { ...detail.project, managerUserId: "u1" } });
          }

          return result;
        }),
      ),
    );
    render(<App />);
    await screen.findByRole("heading", { name: "Vila One" });
    await userEvent.click(screen.getByRole("button", { name: "Editează proiectul" }));
    const manager = await screen.findByRole("combobox", { name: "Manager proiect" });
    await waitFor(() => expect(releasePeople).toBeDefined());
    await act(async () =>
      releasePeople(
        response([{ id: "u1", displayName: "Owner", roles: ["Owner"], disabled: false }]),
      ),
    );
    expect(manager).toHaveValue("u1");
  });

  it("loads people only for management screens and project forms", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Vila One" });
    expect(requests.filter((r) => r.path === "/api/admin/users")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Documente Contractuale" }));
    expect(requests.filter((r) => r.path === "/api/admin/users")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Creează proiect" }));
    await screen.findByRole("dialog", { name: "Creează proiect" });
    await waitFor(() =>
      expect(requests.filter((r) => r.path === "/api/admin/users")).toHaveLength(1),
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(requests.filter((r) => r.path === "/api/admin/users")).toHaveLength(1);
  });

  it("requests assigned projects without calling the management directory", async () => {
    roles = ["Client"];
    const originalFetch = fetch;
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn((input: string, init?: RequestInit) =>
          input === "/api/clients" ? new Promise<Response>(() => {}) : originalFetch(input, init),
        ),
      ),
    );
    render(<App />);
    await screen.findByRole("heading", { name: "Vila One" });
    expect(requests.filter((r) => /^\/api\/projects(?:\?|$)/.test(r.path))).toEqual([
      { path: "/api/projects", body: undefined },
    ]);
    expect(requests.some((r) => r.path === "/api/clients")).toBe(false);
  });

  it("uses the current close callback after a dialog rerenders", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal title="Dialog" onClose={onClose}>
        <input />
      </Modal>,
    );
    const updatedClose = vi.fn();
    rerender(
      <Modal title="Dialog" onClose={updatedClose}>
        <input />
      </Modal>,
    );
    // A gallery navigation button can lose focus when it becomes disabled.
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(updatedClose).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each(["Owner", "Client", "Admin"])(
    "%s logout returns to a clean sign-in screen without refreshing protected data",
    async (role) => {
      roles = [role];
      const originalFetch = fetch;
      let signedOut = false;
      const afterLogout: string[] = [];
      vi.stubGlobal(
        "fetch",
        splitApiMock(
          vi.fn(async (input: string, init?: RequestInit) => {
            if (input === "/api/auth/logout") {
              signedOut = true;

              return response(undefined);
            }

            if (signedOut) {
              afterLogout.push(input);

              return response(undefined, 401);
            }

            return originalFetch(input, init);
          }),
        ),
      );
      render(<App />);
      await screen.findByRole("heading", { name: "Vila One" });
      await userEvent.click(screen.getByRole("button", { name: "Meniu cont" }));
      await userEvent.click(screen.getByRole("button", { name: "Deconectare" }));
      await screen.findByRole("heading", { name: "Welcome" });
      await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(afterLogout).toEqual([]);
    },
  );

  it.each(["/api/clients", "/api/admin/users"])(
    "ignores a late unauthorized response from %s after explicit logout",
    async (path) => {
      const originalFetch = fetch;
      let finish!: (value: Response) => void;
      const pending = new Promise<Response>((resolve) => {
        finish = resolve;
      });
      vi.stubGlobal(
        "fetch",
        splitApiMock(
          vi.fn((input: string, init?: RequestInit) =>
            input === path ? pending : originalFetch(input, init),
          ),
        ),
      );
      render(<App />);
      await screen.findByRole("heading", { name: "Vila One" });
      await userEvent.click(screen.getByRole("button", { name: "Meniu cont" }));
      await userEvent.click(screen.getByRole("button", { name: "Deconectare" }));
      await screen.findByRole("heading", { name: "Welcome" });
      await act(async () => {
        finish(response(undefined, 401));
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("keeps the portal open and displays a genuine logout failure", async () => {
    const originalFetch = fetch;
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn((input: string, init?: RequestInit) =>
          input === "/api/auth/logout"
            ? Promise.resolve(response({ message: "Logout failed" }, 500))
            : originalFetch(input, init),
        ),
      ),
    );
    render(<App />);
    await screen.findByRole("heading", { name: "Vila One" });
    await userEvent.click(screen.getByRole("button", { name: "Meniu cont" }));
    await userEvent.click(screen.getByRole("button", { name: "Deconectare" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Logout failed");
    expect(screen.getByRole("heading", { name: "Vila One" })).toBeVisible();
  });

  it.each(["Owner", "Client", "Admin"])("shows the dashboard contact for %s", async (role) => {
    roles = [role];
    render(<App />);
    expect(await screen.findByText("URMĂTOAREA MENTENANȚĂ")).toBeVisible();
    expect(screen.getByText("Data următoarei mentenanțe nu a fost stabilită.")).toBeVisible();
    const owner = role === "Owner";
    expect(
      await screen.findByText(owner ? "CONTACT CLIENT" : "MANAGER PROIECT"),
    ).toBeInTheDocument();
    expect(screen.getByText(owner ? "Maria Ionescu" : "Andrei Popescu")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: owner ? "maria@example.test" : "manager@example.test" }),
    ).toHaveAttribute("href", owner ? "mailto:maria@example.test" : "mailto:manager@example.test");
    expect(
      screen.getByRole("link", { name: owner ? "+40 722 345 678" : "+40 721 234 567" }),
    ).toHaveAttribute("href", owner ? "tel:+40722345678" : "tel:+40721234567");
    expect(
      screen.queryByText(owner ? "manager@example.test" : "maria@example.test"),
    ).not.toBeInTheDocument();
  });

  it("owner setup sends only the bootstrap key and chosen account details", async () => {
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn(async (input: string, init?: RequestInit) => {
          const path = String(input);
          if (init?.method === "POST") {
            requests.push({ path, body: JSON.parse(init.body as string) });

            return response(undefined);
          }

          return path.endsWith("/me") ? response({}, 401) : response({ required: true });
        }),
      ),
    );
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Română" }));
    await screen.findByRole("heading", { name: "Configurează portalul" });
    await userEvent.selectOptions(screen.getByLabelText("Limba preferată"), "ro");
    expect(screen.queryByLabelText("Username inițial")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Parolă inițială")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Cheie privată de configurare"), "test-key");
    await userEvent.type(screen.getByLabelText("Nume complet"), "Owner");
    await userEvent.type(screen.getByLabelText("Email"), "owner@example.test");
    await userEvent.type(screen.getByLabelText("Parolă nouă"), "owner1");
    await userEvent.type(screen.getByLabelText("Confirmă parola"), "owner1");
    await userEvent.click(screen.getByRole("button", { name: "Salvează și continuă" }));
    await waitFor(() =>
      expect(requests.find((r) => r.path === "/api/auth/setup")?.body).toEqual({
        language: "ro",
        token: "test-key",
        name: "Owner",
        email: "owner@example.test",
        password: "owner1",
        phoneNumber: "",
      }),
    );
  });

  it("shows management selectors and requires an explicit assignment", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Vila One" });
    expect(screen.getByRole("combobox", { name: "Selectează clientul" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Creează proiect" }));
    const choice = await screen.findByRole("combobox", { name: "Client" });
    expect(choice).toBeRequired();
    expect(choice).toHaveValue("");
    await userEvent.selectOptions(choice, "none");
    expect(screen.queryByRole("textbox", { name: "Cod proiect" })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Manager proiect" }), "u1");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Descriere proiect" }),
      "Descriere nouă",
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Denumire" }), "Proiect nou");
    await userEvent.click(screen.getByRole("button", { name: "Salvează proiectul" }));
    await waitFor(() =>
      expect(
        requests.some(
          (r) => r.path === "/api/projects" && (r.body as { clientId: null })?.clientId === null,
        ),
      ).toBe(true),
    );
  });
  it("client sees only the project selector and no management actions", async () => {
    roles = ["Client"];
    render(<App />);
    await screen.findByRole("combobox", { name: "Selectează proiectul" });
    expect(screen.queryByRole("combobox", { name: "Selectează clientul" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Creează proiect" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Utilizatori" })).not.toBeInTheDocument();
  });
  it("opens project editing as an Owner rail page and saves its details", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Vila One" });
    const edit = screen.getByRole("button", { name: "Editează proiectul" });
    expect(edit.closest("nav")).not.toBeNull();
    expect(edit.previousElementSibling).toHaveTextContent("Notițe");
    await userEvent.click(edit);
    expect(await screen.findByRole("heading", { name: "Editează proiectul" })).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(edit).toHaveAttribute("aria-current", "page");
    const name = screen.getByRole("textbox", { name: "Denumire" });
    expect(name).toHaveValue("Vila One");
    await userEvent.clear(name);
    await userEvent.type(name, "Vila actualizată");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Manager proiect" }), "u1");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Descriere proiect" }),
      "Descriere actualizată",
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvează proiectul" }));
    await waitFor(() =>
      expect(requests).toContainEqual({
        path: "/api/projects/p1",
        body: expect.objectContaining({
          name: "Vila actualizată",
          clientId: "c1",
          managerUserId: "u1",
        }),
      }),
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Selectează proiectul" }),
      "p2",
    );
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Denumire" })).toHaveValue("Vila Two"),
    );
  });
  it.each(["Admin", "Client"])("hides Owner project editing from %s", async (role) => {
    roles = [role];
    render(<App />);
    await screen.findByRole("heading", { name: "Vila One" });
    expect(screen.queryByRole("button", { name: "Editează proiectul" })).not.toBeInTheDocument();
  });
  it("renders every rail screen and the document empty state", async () => {
    render(<App />);
    await screen.findByText("Vila One", { selector: "h1" });
    for (const name of [
      "Documente Contractuale",
      "Garanție & Utilizare",
      "Aprobări și documentații tehnice",
      "Progres și foto",
      "Manager fișiere",
    ]) {
      await userEvent.click(screen.getAllByRole("button", { name }).find((b) => b.closest("nav"))!);
      expect(screen.getByRole("heading", { name, level: 1 })).toBeInTheDocument();
      if (name !== "Progres și foto" && name !== "Manager fișiere") {
        expect(await screen.findByText("Niciun fișier aici")).toBeInTheDocument();
      }
    }
  });
  it("offers a retry when the selected project cannot load", async () => {
    const previousFetch = globalThis.fetch;
    let unavailable = true;
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          if (String(input) === "/api/projects/p1" && unavailable) {
            return response({ message: "Temporar indisponibil" }, 503);
          }

          return previousFetch(input, init);
        }),
      ),
    );
    render(<App />);
    await screen.findByRole("heading", {
      name: "Proiectul nu a putut fi încărcat",
    });
    expect(screen.getByText("Temporar indisponibil")).toBeInTheDocument();
    unavailable = false;
    await userEvent.click(screen.getByRole("button", { name: "Reîncearcă" }));
    await screen.findByRole("heading", { name: "Vila One" });
  });
  it("keeps existing and missing category folders read-only even with stale upload capabilities", async () => {
    roles = ["Client"];
    const previousFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          if (String(input) === "/api/projects/p1") {
            return response({
              project: project("p1", "Vila One"),
              files: [],
              events: [],
              updates: [],
              folders: [
                {
                  id: "contracts",
                  name: "Documente Contractuale",
                  parentId: "root",
                  sectionKey: "contracts",
                  clientVisible: true,
                  clientCanUpload: false,
                  canUpload: false,
                  imagesOnly: false,
                },
              ],
              sections: [
                {
                  key: "contracts",
                  name: "Documente Contractuale",
                  clientVisible: true,
                  clientCanUpload: false,
                  canUpload: false,
                  imagesOnly: false,
                },
                {
                  key: "technical",
                  name: "Aprobări și documentații tehnice",
                  clientVisible: true,
                  clientCanUpload: true,
                  canUpload: true,
                  imagesOnly: false,
                },
              ],
            });
          }

          return previousFetch(input, init);
        }),
      ),
    );
    render(<App />);
    await screen.findByRole("heading", { name: "Vila One" });
    await userEvent.click(
      screen.getByRole("button", {
        name: "Documente Contractuale",
      }),
    );
    expect(screen.queryByRole("button", { name: "Încarcă fișier" })).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Aprobări și documentații tehnice",
      }),
    );
    expect(screen.queryByRole("button", { name: "Încarcă fișier" })).not.toBeInTheDocument();
  });
  it("clears activation token and collects email/password", async () => {
    history.replaceState(null, "", "/#activation=secret");
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn(async (input: string) =>
          String(input).endsWith("/me")
            ? response({ message: "Unauthorized" }, 401)
            : response({ required: false }),
        ),
      ),
    );
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Română" }));
    await screen.findByRole("heading", { name: "Activează contul" });
    await userEvent.selectOptions(screen.getByLabelText("Limba preferată"), "ro");
    expect(location.hash).toBe("");
    expect(screen.getByRole("textbox", { name: "Email" })).toBeRequired();
    expect(screen.getByLabelText("Parolă nouă")).toHaveAttribute("minlength", "6");
  });
  it("hamburger moves user management out of rail and supports keyboard dismissal", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Vila One" });
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByText("STATUS PROIECT")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Utilizatori" })).not.toBeInTheDocument();
    const menu = screen.getByRole("button", { name: "Meniu cont" });
    await userEvent.click(menu);
    expect(screen.getByRole("button", { name: "Gestionare utilizatori" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(menu).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Setări cont" })).not.toBeInTheDocument();
    await userEvent.click(menu);
    await userEvent.click(screen.getByRole("button", { name: "Setări cont" }));
    expect(screen.queryByLabelText("Utilizator")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nume complet")).toHaveValue("Owner");
    expect(screen.getByLabelText("Email")).toHaveValue("owner@test.local");
    expect(screen.getByLabelText("Parola curentă pentru salvarea datelor")).toBeRequired();
  });
  it("switches account tabs, preserves details and submits each form separately", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Vila One" });
    await userEvent.click(screen.getByRole("button", { name: "Meniu cont" }));
    await userEvent.click(screen.getByRole("button", { name: "Setări cont" }));
    const details = screen.getByRole("tab", { name: "Datele contului" });
    const security = screen.getByRole("tab", { name: "Securitate" });
    expect(details).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Datele contului");
    await userEvent.clear(screen.getByLabelText("Email"));
    await userEvent.type(screen.getByLabelText("Email"), "updated@example.test");
    await userEvent.click(details);
    await userEvent.keyboard("{ArrowDown}");
    expect(security).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Securitate");
    expect(screen.getByLabelText("Email")).not.toBeVisible();
    await userEvent.keyboard("{ArrowUp}");
    expect(details).toHaveFocus();
    expect(screen.getByLabelText("Email")).toHaveValue("updated@example.test");
    await userEvent.type(screen.getByLabelText("Parola curentă pentru salvarea datelor"), "owner1");
    await userEvent.click(screen.getByRole("button", { name: "Salvează datele contului" }));
    await waitFor(() =>
      expect(requests.find((r) => r.path.endsWith("/profile"))?.body).toMatchObject({
        email: "updated@example.test",
        currentPassword: "owner1",
      }),
    );
    expect(requests.find((r) => r.path.endsWith("/profile"))?.body).not.toHaveProperty("userName");
    await userEvent.click(security);
    await userEvent.type(screen.getByLabelText("Parola curentă", { exact: true }), "owner1");
    await userEvent.type(screen.getByLabelText("Parolă nouă (minimum 6 caractere)"), "updated1");
    await userEvent.type(screen.getByLabelText("Confirmă parola"), "updated1");
    await userEvent.click(screen.getByRole("button", { name: "Salvează parola" }));
    await waitFor(() =>
      expect(requests.find((r) => r.path.endsWith("/password"))?.body).toMatchObject({
        currentPassword: "owner1",
        password: "updated1",
      }),
    );
  });
  it("hides undefined stages for clients and keeps progress posting available for managers", async () => {
    const previousFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          if (String(input) === "/api/projects/p1") {
            return response({
              project: {
                ...project("p1", "Vila One"),
                milestones: [],
                stageId: null,
              },
              files: [],
              folders: [],
              sections: [],
              events: [],
              updates: [],
            });
          }

          return previousFetch(input, init);
        }),
      ),
    );
    roles = ["Client"];
    const { unmount } = render(<App />);
    await screen.findByRole("heading", { name: "Vila One" });
    expect(screen.queryByRole("heading", { name: "Etapele proiectului" })).not.toBeInTheDocument();
    expect(screen.queryByText("Etapa curentă")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Meniu cont" }));
    expect(
      screen.queryByRole("button", { name: "Gestionare utilizatori" }),
    ).not.toBeInTheDocument();
    unmount();
    roles = ["Owner"];
    render(<App />);
    await screen.findByRole("heading", { name: "Vila One" });
    await userEvent.click(screen.getByRole("button", { name: "Progres și foto" }));
    await userEvent.click(screen.getByRole("button", { name: "Adaugă activitate" }));
    expect(screen.queryByLabelText("Etapa proiectului (opțional)")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Titlu"), "Independent");
    await userEvent.click(screen.getByRole("button", { name: "Salvează activitatea" }));
    await waitFor(() =>
      expect(requests.find((r) => r.path.endsWith("/updates"))?.body).toMatchObject({
        title: "Independent",
      }),
    );
  });
  it("prefills activation contact details and lets the client choose their personal name", async () => {
    history.replaceState(null, "", "/#activation=secret");
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn(async (input: string, init?: RequestInit) => {
          if (input.endsWith("activation-details")) {
            return response({
              name: "Contact",
              email: "contact@example.test",
              phoneNumber: "0722123456",
            });
          }

          if (input.endsWith("/me")) {
            return response({}, 401);
          }

          if (input.endsWith("/activate")) {
            requests.push({
              path: input,
              body: JSON.parse(init!.body as string),
            });

            return response({}, 400);
          }

          return response({ required: false });
        }),
      ),
    );
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Română" }));
    await screen.findByRole("heading", { name: "Activează contul" });
    await userEvent.selectOptions(screen.getByLabelText("Limba preferată"), "ro");
    expect(screen.getByLabelText("Email")).toHaveValue("contact@example.test");
    expect(screen.getByLabelText("Telefon")).toHaveValue("0722123456");
    await userEvent.clear(screen.getByLabelText("Nume complet"));
    await userEvent.type(screen.getByLabelText("Nume complet"), "Numele personal");
    await userEvent.type(screen.getByLabelText("Parolă nouă"), "client1");
    await userEvent.type(screen.getByLabelText("Confirmă parola"), "client1");
    await userEvent.click(screen.getByRole("button", { name: "Salvează și continuă" }));
    await waitFor(() =>
      expect(requests.find((r) => r.path.endsWith("/activate"))?.body).toEqual({
        language: "ro",
        token: "secret",
        name: "Numele personal",
        email: "contact@example.test",
        phoneNumber: "0722123456",
        password: "client1",
      }),
    );
  });
  it("reset form cannot change email", async () => {
    history.replaceState(null, "", "/#reset=secret");
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn(async (input: string) =>
          String(input).endsWith("/me")
            ? response({ message: "Unauthorized" }, 401)
            : response({ required: false }),
        ),
      ),
    );
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Română" }));
    await screen.findByRole("heading", { name: "Parolă nouă" });
    expect(screen.queryByRole("textbox", { name: "Email" })).not.toBeInTheDocument();
    expect(location.hash).toBe("");
  });
  it("ignores a late response after switching projects", async () => {
    let release!: (value: Response) => void;
    const original = fetch;
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn((input: string, init?: RequestInit) =>
          String(input) === "/api/projects/p1"
            ? new Promise<Response>((resolve) => {
                release = resolve;
              })
            : original(input, init),
        ),
      ),
    );
    render(<App />);
    const selector = await screen.findByRole("combobox", {
      name: "Selectează proiectul",
    });
    await waitFor(() => expect(release).toBeDefined());
    await userEvent.selectOptions(selector, "p2");
    await screen.findByText("Vila Two", { selector: "h1" });
    release(
      response({
        project: project("p1", "Vila One"),
        files: [],
        approvals: [],
        events: [],
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
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Vila One", { selector: "h1" })).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Vila Two", { selector: "h1" })).toBeInTheDocument();
  });
  it("keeps keyboard focus inside dialogs and restores it", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(
      <Modal title="Test dialog" onClose={() => {}}>
        <input aria-label="Name" />
        <button>Last</button>
      </Modal>,
    );
    const last = screen.getByRole("button", { name: "Last" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Închide" })).toHaveFocus();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
