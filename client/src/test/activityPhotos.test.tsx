import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActivityPhotos } from "../components/ActivityPhotos";
import type { PageContext } from "../pages/PageContext";
import type { CalendarEntry, ProjectFile } from "../types/portal";

const file = (id: string): ProjectFile => ({
  id,
  title: id,
  folderId: "progress",
  content: {
    id,
    fileName: `${id}.png`,
    contentType: "image/png",
    size: 100,
    createdAt: "2026-10-14",
    sha256: "",
  },
});
const entry: CalendarEntry = {
  id: "entry",
  title: "Montaj",
  details: "Descriere",
  occurredAt: "2026-10-14",
  photoContentId: "first",
  photoIds: ["first", "second"],
};
const context = () =>
  ({
    project: { files: [file("first"), file("second")] },
    projects: { selectedId: "project" },
    navigation: { setPreviewFile: vi.fn(), setPreviewGalleryId: vi.fn(), setModal: vi.fn() },
  }) as unknown as PageContext;

describe("activity photos", () => {
  it("shows previews and opens the clicked photo in its activity gallery", async () => {
    const v = context();
    render(<ActivityPhotos entry={entry} context={v} />);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Fotografia următoare" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Deschide fotografia second" }));
    expect(v.navigation.setPreviewFile).toHaveBeenCalledWith(v.project.files[1]);
    expect(v.navigation.setPreviewGalleryId).toHaveBeenCalledWith(entry.id);
    expect(v.navigation.setModal).toHaveBeenCalledWith("photo");
  });
  it("caps previews at three and describes the extra photo count", async () => {
    const v = {
      ...context(),
      project: {
        ...context().project,
        files: [file("first"), file("second"), file("third"), file("fourth"), file("fifth")],
      },
    };
    render(
      <ActivityPhotos
        entry={{ ...entry, photoIds: v.project.files.map((f) => f.content.id) }}
        context={v}
      />,
    );
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.getByText("+2")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Deschide fotografia third; încă 2 fotografii",
      }),
    );
    expect(v.navigation.setPreviewFile).toHaveBeenCalledWith(v.project.files[2]);
  });
  it("skips unavailable references and leaves text-only posts without a gallery", () => {
    const v = context();
    const { rerender, container } = render(
      <ActivityPhotos entry={{ ...entry, photoIds: ["missing", "first", "first"] }} context={v} />,
    );
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    rerender(
      <ActivityPhotos entry={{ ...entry, photoIds: [], photoContentId: null }} context={v} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
