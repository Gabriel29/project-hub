import { useCallback, useMemo } from "react";

import { projectsApi } from "../services/api/projects";
import type { Detail, Folder, ProjectOverview } from "../types/portal";
import { type PageId, pageSection } from "./navigation";
import { useScopedResource } from "./useScopedResource";

export function useProjectResources(
  userId: string | undefined,
  projectId: string,
  overview: ProjectOverview | null,
  page: PageId,
  activeFolder: string | null,
  search: string,
) {
  const scope = userId && projectId ? `${userId}/${projectId}` : "";
  const loadSections = useCallback(() => projectsApi.sections(projectId), [projectId]);
  const sections = useScopedResource(scope && `${scope}/sections`, loadSections);
  const sectionKey = pageSection(page);
  const documentPage = page === "files" || (!!sectionKey && sectionKey !== "progress");
  const folderId = documentPage
    ? (activeFolder ??
      (sectionKey
        ? sections.value?.find((s) => s.key === sectionKey)?.folderId
        : overview?.rootFolderId) ??
      null)
    : null;
  const loadContents = useCallback(
    () => projectsApi.contents(projectId, folderId!, search.trim()),
    [projectId, folderId, search],
  );
  const contents = useScopedResource(
    scope && folderId ? `${scope}/folder/${folderId}/${search.trim()}` : "",
    loadContents,
    search.trim() ? 250 : 0,
  );
  const feedPage = page === "dashboard" || page === "progress";
  const loadFeed = useCallback(
    () => projectsApi.activities(projectId, page === "dashboard"),
    [projectId, page],
  );
  const feed = useScopedResource(scope && feedPage ? `${scope}/activities/${page}` : "", loadFeed);
  const loadRecent = useCallback(() => projectsApi.recent(projectId), [projectId]);
  const recent = useScopedResource(
    scope && page === "dashboard" ? `${scope}/recent` : "",
    loadRecent,
  );
  const sectionFolders: Folder[] = useMemo(
    () =>
      (sections.value ?? []).map((s) => ({
        id: s.folderId,
        name: s.name,
        parentId: null,
        sectionKey: s.key,
        clientVisible: s.clientVisible,
        clientCanUpload: s.clientCanUpload,
        canUpload: s.canUpload,
        imagesOnly: s.imagesOnly,
      })),
    [sections.value],
  );
  const detail: Detail | null = useMemo(
    () =>
      overview
        ? {
            ...overview,
            files: [
              ...new Map(
                [
                  ...(contents.value?.files ?? []),
                  ...(feed.value?.files ?? []),
                  ...(recent.value?.files ?? []),
                ].map((f) => [f.id, f]),
              ).values(),
            ],
            folders: [
              ...new Map(
                [
                  ...sectionFolders,
                  ...(recent.value?.folders ?? []),
                  ...(contents.value?.paths ?? []),
                  ...(contents.value?.breadcrumbs ?? []),
                  ...(contents.value ? [contents.value.folder] : []),
                  ...(contents.value?.folders ?? []),
                ].map((f) => [f.id, f]),
              ).values(),
            ],
            sections: sections.value ?? [],
            updates: feed.value?.updates ?? [],
            events: [],
          }
        : null,
    [overview, sectionFolders, sections.value, contents.value, feed.value, recent.value],
  );
  const refresh = useCallback(async () => {
    await Promise.all([sections.refresh(), contents.refresh(), feed.refresh(), recent.refresh()]);
  }, [sections.refresh, contents.refresh, feed.refresh, recent.refresh]);

  return {
    detail,
    folderId,
    listing: contents.value,
    resourceError: sections.error || contents.error || feed.error || recent.error,
    resourceLoading: documentPage
      ? sections.loading || contents.loading
      : feedPage
        ? feed.loading || recent.loading
        : false,
    refresh,
  };
}
