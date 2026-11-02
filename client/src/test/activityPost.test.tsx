import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ActivityPost } from "../components/ActivityPost";
import type { PageContext } from "../pages/PageContext";
import type { CalendarEntry } from "../types/portal";

const context = {
  project: { files: [], orderedStages: [] },
  session: { isManager: false },
  navigation: { setModal: vi.fn() },
} as unknown as PageContext;
const entry: CalendarEntry = {
  id: "update",
  title: "Montaj",
  details: "Detalii de șantier. ".repeat(30),
  occurredAt: "2026-10-14T12:00:00Z",
  photoIds: [],
  photoContentId: null,
};
it("lets clients expand and collapse a long dashboard update", async () => {
  render(<ActivityPost entry={entry} context={context} compact />);
  const expand = screen.getByRole("button", { name: "Citește mai mult" });
  expect(expand).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(expand);
  const collapse = screen.getByRole("button", { name: "Arată mai puțin" });
  expect(collapse).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText(entry.details.trim())).toBeVisible();
  await userEvent.click(collapse);
  expect(screen.getByRole("button", { name: "Citește mai mult" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
it("keeps short multiline summaries expandable and full journal text visible", () => {
  const { rerender } = render(
    <ActivityPost entry={{ ...entry, details: "A\nB\nC\nD\nE" }} context={context} compact />,
  );
  expect(screen.getByRole("button", { name: "Citește mai mult" })).toBeVisible();
  rerender(<ActivityPost entry={entry} context={context} />);
  expect(screen.queryByRole("button", { name: "Citește mai mult" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Montaj" })).toBeVisible();
  expect(screen.queryByRole("group", { name: /Fotografii/ })).not.toBeInTheDocument();
});
