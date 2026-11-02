import { useCallback, useState } from "react";

import type { CalendarEntry, ProjectFile } from "../types/portal";
import type { PageId } from "./navigation";

// UI state stays here; server records belong to their feature hooks.
export function usePortalNavigation() {
  const [page, setPage] = useState<PageId>("dashboard");
  const [modal, setModal] = useState("");
  const [sidebar, setSidebar] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);
  const [previewGalleryId, setPreviewGalleryId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);

  const resetProjectView = useCallback(() => {
    setActiveFolder(null);
    setSearch("");
    setModal("");
    setPreviewFile(null);
    setPreviewGalleryId(null);
    setEditingEntry(null);
  }, []);

  function go(page: PageId) {
    resetProjectView();
    setPage(page);
    setSidebar(false);
  }

  function reset() {
    go("dashboard");
  }

  function openUpload() {
    setPreviewFile(null);
    setPreviewGalleryId(null);
    setModal("upload");
  }

  return {
    page,
    go,
    modal,
    setModal,
    sidebar,
    setSidebar,
    search,
    setSearch,
    activeFolder,
    setActiveFolder,
    previewFile,
    setPreviewFile,
    previewGalleryId,
    setPreviewGalleryId,
    editingEntry,
    setEditingEntry,
    resetProjectView,
    reset,
    openUpload,
  };
}
