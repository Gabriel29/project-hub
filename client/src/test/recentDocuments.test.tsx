import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { RecentDocuments } from "../components/RecentDocuments";
import { setLanguage } from "../i18n";
import type { PageContext } from "../pages/PageContext";
import type { Folder, ProjectFile } from "../types/portal";

const folder = (
  id: string,
  sectionKey: Folder["sectionKey"],
  parentId: string | null,
  clientVisible = true,
): Folder => ({
  id,
  name: id,
  sectionKey,
  parentId,
  clientVisible,
  clientCanUpload: false,
  canUpload: false,
  imagesOnly: false,
});
const folders = [
  folder("root", null, null, false),
  folder("contracts", "contracts", "root"),
  folder("child", null, "contracts"),
  folder("hidden", null, "contracts", false),
  folder("progress", "progress", "root"),
  folder("progress-child", null, "progress"),
];
const file = (
  id: string,
  folderId = "child",
  contentType = "application/pdf",
  calendarPhoto = false,
): ProjectFile => ({
  id,
  folderId,
  title: id,
  calendarPhoto,
  content: { id, fileName: id, contentType, size: 1, createdAt: "2026-10-15", sha256: "" },
});
const context = (role = "Owner", files = [file("Contract")]) =>
  ({
    project: { files, folders },
    projects: { selectedId: "project" },
    session: { user: { roles: [role] }, isManager: role !== "Client" },
    navigation: {
      go: vi.fn(),
      setActiveFolder: vi.fn(),
      setPreviewFile: vi.fn(),
      setPreviewGalleryId: vi.fn(),
      setModal: vi.fn(),
    },
  }) as unknown as PageContext;
beforeEach(() => setLanguage("en"));
it.each(["Owner", "Admin", "Client"])("shows View all only for Owner (%s)", async (role) => {
  const v = context(role);
  render(<RecentDocuments context={v} />);
  if (role === "Owner") {
    await userEvent.click(screen.getByRole("button", { name: "View all" }));
    expect(v.navigation.go).toHaveBeenCalledWith("files");
  } else {
    expect(screen.queryByRole("button", { name: "View all" })).not.toBeInTheDocument();
  }
});
it.each(["Owner", "Admin", "Client"])(
  "excludes Progress and photos and its descendants for %s",
  (role) => {
    const v = context(role, [
      file("Contract"),
      file("Private", "root"),
      file("Inaccessible", "hidden"),
      file("Orphan", "missing"),
      file("Photo", "progress", "image/png", true),
      file("Nested photo", "progress-child", "image/png"),
      file("Progress PDF", "progress"),
    ]);
    render(<RecentDocuments context={v} />);
    expect(screen.getByRole("link", { name: "Open Contract" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Open Photo" })).not.toBeInTheDocument();
    for (const name of ["Private", "Orphan", "Nested photo", "Progress PDF"]) {
      expect(screen.queryByRole("link", { name: "Open " + name })).not.toBeInTheDocument();
    }

    if (role === "Client") {
      expect(screen.queryByRole("link", { name: "Open Inaccessible" })).not.toBeInTheDocument();
    }
  },
);
it("opens previews from the title and keeps download and navigation independent", async () => {
  const v = context();
  render(<RecentDocuments context={v} />);
  await userEvent.click(screen.getByRole("link", { name: "Open Contract" }));
  expect(v.navigation.setPreviewGalleryId).toHaveBeenCalledWith(null);
  expect(v.navigation.setPreviewFile).toHaveBeenCalledWith(v.project.files[0]);
  expect(v.navigation.setModal).toHaveBeenCalledWith("pdf");
  expect(v.navigation.go).not.toHaveBeenCalled();
  const download = screen.getByRole("link", { name: "Download Contract" });
  expect(download).toHaveAttribute("href", "/api/projects/project/files/Contract/content");
  expect(download).toHaveAttribute("download");
  await userEvent.click(
    screen.getByRole("button", { name: "Open Contractual documents tab for Contract" }),
  );
  expect(v.navigation.go).toHaveBeenCalledWith("contracts");
  expect(v.navigation.setActiveFolder).toHaveBeenCalledWith("child");
});
it("opens photos individually and keeps other file types as native download links", async () => {
  const v = context("Owner", [
    file("Photo", "child", "image/png"),
    file(
      "Spreadsheet",
      "child",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
  ]);
  render(<RecentDocuments context={v} />);
  await userEvent.click(screen.getByRole("link", { name: "Open Photo" }));
  expect(v.navigation.setModal).toHaveBeenCalledWith("photo");
  expect(screen.getByRole("link", { name: "Open Spreadsheet" })).toHaveAttribute(
    "href",
    "/api/projects/project/files/Spreadsheet/content",
  );
  expect(screen.getByRole("link", { name: "Open Spreadsheet" })).toHaveAttribute(
    "download",
    "Spreadsheet",
  );
});
it("orders eligible files before applying the six-file limit and shows an empty state", () => {
  const files = Array.from({ length: 8 }, (_, i) => ({
    ...file("File " + i),
    content: { ...file("File " + i).content, createdAt: `2026-10-${10 + i}` },
  }));
  const { container, rerender } = render(
    <RecentDocuments context={context("Owner", [...files, file("Private", "root")])} />,
  );
  const rows = container.querySelectorAll(".recent-document-link");
  expect(rows).toHaveLength(6);
  expect(within(rows[0] as HTMLElement).getByRole("link", { name: "Open File 7" })).toBeVisible();
  rerender(<RecentDocuments context={context("Owner", [file("Private", "root")])} />);
  expect(screen.getByText("Shared documents will appear here.")).toBeVisible();
});
