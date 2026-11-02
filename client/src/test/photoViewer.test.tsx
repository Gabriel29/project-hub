import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";

import { PhotoViewer } from "../components/PhotoViewer";
import type { ProjectFile } from "../types/portal";

const files = ["first", "second"].map(
  (id) =>
    ({
      id,
      title: id,
      content: { id, contentType: "image/png", fileName: id + ".png" },
    }) as ProjectFile,
);

function Gallery({ photos = files }: { photos?: ProjectFile[] }) {
  const [selected, select] = useState(photos[0]);

  return (
    <PhotoViewer
      photos={photos}
      selected={selected}
      select={select}
      project="project"
      title="Post title"
      carousel
    />
  );
}

it("keeps carousel content minimal and downloads the currently selected photo", async () => {
  const { container } = render(<Gallery />);
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  expect(screen.queryByText("Private photo caption")).not.toBeInTheDocument();
  expect(screen.queryByText("Post title")).not.toBeInTheDocument();
  const download = screen.getByRole("link", { name: "Descarcă fotografia" });
  expect(container.querySelector(".photo-viewer-image")).toContainElement(download);
  expect(download).toHaveAttribute("href", "/api/projects/project/files/first/content");
  await userEvent.click(screen.getByRole("button", { name: "Fotografia următoare" }));
  expect(screen.getByRole("img")).toHaveAttribute("alt", "second");
  expect(download).toHaveAttribute("href", "/api/projects/project/files/second/content");
  await userEvent.keyboard("{ArrowLeft}");
  expect(download).toHaveAttribute("href", "/api/projects/project/files/first/content");
});
it("also omits captions for a single-photo activity gallery", () => {
  render(<Gallery photos={[files[0]]} />);
  expect(screen.getByRole("link", { name: "Descarcă fotografia" })).toBeVisible();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  expect(screen.queryByText("Private photo caption")).not.toBeInTheDocument();
});
it("uses the same minimal viewer and download for a single File Manager photo", () => {
  render(
    <PhotoViewer
      photos={[files[0]]}
      selected={files[0]}
      select={() => {}}
      project="project"
      carousel={false}
    />,
  );
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Descarcă fotografia" })).toHaveAttribute(
    "href",
    "/api/projects/project/files/first/content",
  );
  expect(screen.queryByText("Private photo caption")).not.toBeInTheDocument();
});
