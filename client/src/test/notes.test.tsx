import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { setLanguage } from "../i18n";
import { NotesPage } from "../pages/NotesPage";
import type { PageContext } from "../pages/PageContext";
import { notesApi } from "../services/api/notes";

const note = {
  id: "n1",
  title: "Installation details",
  body: "Long note. ".repeat(500),
  updatedAt: "2026-10-16",
  createdAt: "2026-10-16",
};
afterEach(() => vi.restoreAllMocks());
it("opens the full note by keyboard and keeps edit and delete inside the action menu", async () => {
  setLanguage("en");
  vi.spyOn(notesApi, "list").mockResolvedValue([note]);
  const save = vi.spyOn(notesApi, "save").mockResolvedValue(undefined);
  const remove = vi.spyOn(notesApi, "delete").mockResolvedValue(undefined);
  const events = userEvent.setup();
  render(<NotesPage {...({ projects: { selectedId: "p1" } } as PageContext)} />);
  const preview = await screen.findByRole("button", { name: note.title });
  expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  preview.focus();
  await events.keyboard("{Enter}");
  const dialog = screen.getByRole("dialog", { name: note.title });
  expect(dialog).toHaveTextContent(note.body.trim());
  await events.keyboard("{Escape}");
  expect(preview).toHaveFocus();
  await events.click(screen.getByRole("button", { name: `Menu ${note.title}` }));
  await events.click(screen.getByRole("button", { name: "Edit" }));
  const edit = screen.getByRole("dialog");
  expect(within(edit).getByRole("textbox", { name: "Note" })).toHaveValue(note.body);
  await events.click(within(edit).getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledWith("p1", { title: note.title, body: note.body }, note.id);
  await events.click(screen.getByRole("button", { name: `Menu ${note.title}` }));
  await events.click(screen.getByRole("button", { name: "Delete" }));
  expect(remove).not.toHaveBeenCalled();
  await events.click(screen.getByRole("button", { name: "Confirm deletion" }));
  expect(remove).toHaveBeenCalledWith("p1", note.id);
});
