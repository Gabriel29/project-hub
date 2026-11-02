import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { FileTile } from "../components/FileTile";
import { setLanguage } from "../i18n";
import type { Portal } from "../logic/usePortal";
import { filesApi } from "../services/api/files";
import type { ProjectFile } from "../types/portal";

const file: ProjectFile = {
  id: "f1",
  title: "Original name",
  folderId: "root",
  content: {
    id: "content",
    fileName: "original.pdf",
    contentType: "application/pdf",
    size: 10,
    createdAt: "2026-10-16",
    sha256: "digest",
  },
};
const context = (manager: boolean) =>
  ({
    projects: { selectedId: "p1" },
    session: { isManager: manager },
    project: { folders: [], run: vi.fn(async (action: () => Promise<unknown>) => action()) },
    feedback: { busy: false, setError: vi.fn() },
    navigation: {},
  }) as unknown as Portal;
afterEach(() => vi.restoreAllMocks());
it("managers can rename a file through its popup", async () => {
  setLanguage("en");
  const rename = vi.spyOn(filesApi, "rename").mockResolvedValue(undefined);
  const events = userEvent.setup();
  render(<FileTile context={context(true)} file={file} location="Root / Contracts" />);
  expect(screen.getByRole("button", { name: file.title })).toHaveAttribute(
    "title",
    "Root / Contracts",
  );
  expect(screen.queryByText("Root / Contracts")).not.toBeInTheDocument();
  await events.click(screen.getByLabelText(`Menu ${file.title}`));
  await events.click(screen.getByRole("button", { name: "Rename" }));
  const dialog = screen.getByRole("dialog", { name: `Rename ${file.title}` });
  const input = within(dialog).getByRole("textbox", { name: "Name" });
  expect(input).toHaveValue(file.title);
  await events.clear(input);
  await events.type(input, "  Signed contract  ");
  await events.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(rename).toHaveBeenCalledWith("p1", "f1", "Signed contract");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("does not offer rename to clients", async () => {
  setLanguage("en");
  render(<FileTile context={context(false)} file={file} />);
  await userEvent.click(screen.getByLabelText(`Menu ${file.title}`));
  expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
});

it("managers can rename ordinary folders with the folder name limit", async () => {
  setLanguage("en");
  const rename = vi.spyOn(filesApi, "renameFolder").mockResolvedValue(undefined);
  const events = userEvent.setup();
  const folder = {
    id: "folder",
    name: "Archive",
    parentId: "contracts",
    sectionKey: null,
    clientVisible: true,
    clientCanUpload: false,
    canUpload: true,
    imagesOnly: false,
  };
  render(<FileTile context={context(true)} folder={folder} />);
  await events.click(screen.getByLabelText("Menu Archive"));
  await events.click(screen.getByRole("button", { name: "Rename" }));
  const dialog = screen.getByRole("dialog", { name: "Rename folder Archive" });
  const input = within(dialog).getByRole("textbox", { name: "Name" });
  expect(input).toHaveAttribute("maxlength", "120");
  await events.clear(input);
  await events.type(input, "  Signed contracts  ");
  await events.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(rename).toHaveBeenCalledWith("p1", "folder", "Signed contracts");
});

it("does not offer folder rename to clients or for root and section folders", async () => {
  setLanguage("en");
  const base = {
    name: "Archive",
    clientVisible: true,
    clientCanUpload: false,
    canUpload: true,
    imagesOnly: false,
  };
  render(
    <>
      <FileTile
        context={context(false)}
        folder={{ ...base, id: "client-folder", parentId: "root", sectionKey: null }}
      />
      <FileTile
        context={context(true)}
        folder={{ ...base, id: "root", parentId: null, sectionKey: null }}
      />
      <FileTile
        context={context(true)}
        folder={{ ...base, id: "contracts", parentId: "root", sectionKey: "contracts" }}
      />
    </>,
  );
  for (const menu of screen.getAllByLabelText(/^Menu /)) {
    await userEvent.click(menu);
  }

  expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
});
