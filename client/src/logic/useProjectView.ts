import { useMemo } from "react";

import type { Detail } from "../types/portal";
import { type PageId, pageSection, sectionFor } from "./navigation";

// Derive the current project view without duplicating server data in state.
export function useProjectView(
  detail: Detail | null,
  page: PageId,
  activeFolder: string | null,
  admin: boolean,
) {
  const p = detail?.project;
  const files = detail?.files ?? [];
  const folders = detail?.folders ?? [];
  const updates = detail?.updates ?? [];
  const documents = useMemo(
    () =>
      (detail?.files ?? [])
        .filter((file) => !file.calendarPhoto)
        .sort((a, b) => (b.content?.createdAt ?? "").localeCompare(a.content?.createdAt ?? "")),
    [detail?.files],
  );
  const orderedStages = useMemo(
    () => [...(p?.milestones ?? [])].sort((a, b) => a.orderIndex - b.orderIndex),
    [p?.milestones],
  );
  const stageIndex = p?.stagesCompleted
    ? orderedStages.length
    : orderedStages.findIndex((stage) => stage.id === p?.stageId);
  const sectionKey = pageSection(page);
  const sectionRoot = folders.find((f) => f.sectionKey === sectionKey && sectionKey !== null);
  const validActiveFolder =
    activeFolder &&
    folders.some((f) => f.id === activeFolder) &&
    (!sectionKey || sectionFor(folders, activeFolder) === sectionKey)
      ? activeFolder
      : null;
  const currentFolder =
    validActiveFolder ??
    sectionRoot?.id ??
    (sectionKey ? null : (folders.find((f) => f.parentId === null)?.id ?? null));
  const currentFolderDto = folders.find((f) => f.id === currentFolder);
  const folderSectionKey = sectionFor(folders, currentFolder) ?? sectionKey;
  const folderPolicy = detail?.sections?.find((s) => s.key === folderSectionKey);
  const canUpload = admin && (currentFolderDto?.canUpload ?? folderPolicy?.canUpload ?? admin);
  const imagesOnly = currentFolderDto?.imagesOnly ?? folderPolicy?.imagesOnly ?? false;

  return {
    p,
    files,
    folders,
    updates,
    documents,
    orderedStages,
    stageIndex,
    sectionKey,
    sectionRoot,
    currentFolder,
    folderSectionKey,
    canUpload,
    imagesOnly,
  };
}
