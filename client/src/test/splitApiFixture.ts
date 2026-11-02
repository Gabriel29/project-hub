import type { Detail, Folder, FolderSection, ProjectFile } from "../types/portal";

// Keep scenario fixtures concise while serving the same split contracts as the API.
export function fixturePath(url: string, method = "GET") {
  const path = new URL(url, "http://localhost").pathname;

  return method === "GET"
    ? path.replace(
        /^(\/api\/projects\/[^/]+)\/(?:sections|activities|recent-documents|events|folders\/[^/]+\/(?:contents|search))$/,
        "$1",
      )
    : path;
}

export function splitApiFixture(url: string, data: unknown, manager = true): unknown {
  if (!data || typeof data !== "object" || !("project" in data)) {
    return data;
  }

  const detail = data as Detail;
  if ("rootFolderId" in detail) {
    manager = !!detail.rootFolderId;
  }

  const path = new URL(url, "http://localhost");
  const root: Folder = detail.folders?.find((f) => f.parentId === null && !f.sectionKey) ?? {
    id: "root",
    name: "Root",
    parentId: null,
    sectionKey: null,
    clientVisible: false,
    clientCanUpload: false,
    canUpload: true,
    imagesOnly: false,
  };
  const definitions = ["progress", "contracts", "warranty", "maintenance", "technical"].map(
    (key) =>
      detail.sections?.find((s) => s.key === key) ?? {
        key,
        name: `.${key}`,
        clientVisible: true,
        clientCanUpload: false,
        canUpload: manager,
        imagesOnly: false,
      },
  ) as FolderSection[];
  const sections = definitions
    .map((section) => ({
      ...section,
      folderId:
        detail.folders?.find((f) => f.sectionKey === section.key)?.id ?? `section-${section.key}`,
    }))
    .filter((s) => manager || s.key !== "progress");
  const folders = [...(detail.folders ?? [])];
  if (!folders.some((f) => f.id === root.id)) {
    folders.push(root);
  }

  for (const section of sections) {
    if (!folders.some((f) => f.id === section.folderId)) {
      folders.push({
        id: section.folderId,
        name: section.name,
        parentId: root.id,
        sectionKey: section.key,
        clientVisible: true,
        clientCanUpload: false,
        canUpload: manager,
        imagesOnly: false,
      });
    }
  }

  const byId = new Map(folders.map((f) => [f.id, f]));
  const ancestry = (id: string | null) => {
    const result: Folder[] = [];
    const visited = new Set<string>();
    while (id && !visited.has(id)) {
      visited.add(id);
      const folder = byId.get(id);
      if (!folder || (!manager && !folder.parentId && !folder.sectionKey)) {
        break;
      }

      result.unshift({
        ...folder,
        parentId: !manager && folder.sectionKey ? null : folder.parentId,
      });
      id = folder.parentId;
    }

    return result;
  };

  const sectionFor = (file: ProjectFile) =>
    ancestry(file.folderId).find((f) => f.sectionKey)?.sectionKey;
  if (path.pathname.endsWith("/sections")) {
    return sections;
  }

  if (path.pathname.endsWith("/activities")) {
    const updates = path.searchParams.has("limit")
      ? (detail.updates ?? []).slice(0, Number(path.searchParams.get("limit")))
      : (detail.updates ?? []);
    const ids = new Set(updates.flatMap((e) => [...(e.photoIds ?? []), e.photoContentId]));

    return { updates, files: (detail.files ?? []).filter((f) => ids.has(f.content.id)) };
  }

  if (path.pathname.endsWith("/recent-documents")) {
    const files = (detail.files ?? [])
      .filter((f) => {
        const section = sectionFor(f);

        return section && section !== "progress";
      })
      .sort((a, b) => b.content.createdAt.localeCompare(a.content.createdAt))
      .slice(0, 6);

    return {
      files,
      folders: [
        ...new Map(files.flatMap((f) => ancestry(f.folderId)).map((f) => [f.id, f])).values(),
      ],
    };
  }

  if (path.pathname.endsWith("/events")) {
    return detail.events ?? [];
  }

  const match = path.pathname.match(/\/folders\/([^/]+)\/(contents|search)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const query =
      path.searchParams
        .get("query")
        ?.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase() ?? "";
    const matches = (text: string) =>
      text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(query);
    const within = (folderId: string | null) => ancestry(folderId).some((f) => f.id === id);
    const files = (detail.files ?? []).filter((f) =>
      match[2] === "contents"
        ? f.folderId === id
        : within(f.folderId) && (matches(f.title) || matches(f.content.fileName)),
    );
    const children = folders.filter(
      (f) =>
        f.id !== id &&
        (match[2] === "contents" ? f.parentId === id : within(f.id) && matches(f.name)),
    );

    return {
      folder: byId.get(id),
      breadcrumbs: ancestry(id),
      folders: children,
      files,
      paths:
        match[2] === "search"
          ? [
              ...new Map(
                [
                  ...files.flatMap((f) => ancestry(f.folderId)),
                  ...children.flatMap((f) => ancestry(f.id)),
                ].map((f) => [f.id, f]),
              ).values(),
            ]
          : [],
    };
  }

  return { project: detail.project, rootFolderId: manager ? root.id : null };
}

export function splitApiMock(fetch: (input: string, init?: RequestInit) => Promise<Response>) {
  let manager = true;

  return async (input: string, init?: RequestInit) => {
    const original = new URL(input, "http://localhost");
    const normalized = fixturePath(input, init?.method);
    const response = await fetch(normalized === original.pathname ? input : normalized, init);
    if (!response.ok || (init?.method && init.method !== "GET")) {
      return response;
    }

    try {
      const data: unknown = await response.clone().json();
      if (data && typeof data === "object" && "roles" in data && Array.isArray(data.roles)) {
        manager = data.roles.some((role: string) => role === "Owner" || role === "Admin");
      }

      if (!data || typeof data !== "object" || !("project" in data)) {
        return response;
      }

      return new Response(JSON.stringify(splitApiFixture(input, data, manager)), {
        status: response.status,
        headers: response.headers,
      });
    } catch {
      return response;
    }
  };
}
