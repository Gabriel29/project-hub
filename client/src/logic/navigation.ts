import { t } from "../i18n";
import type { Folder } from "../types/portal";

export const sections = {
  progress: "navigation.progress",
  contracts: "navigation.contracts",
  warranty: "navigation.warranty",
  maintenance: "navigation.maintenance",
  technical: "navigation.technical",
} as const;

export type SectionKey = keyof typeof sections;

export const pageLabels = {
  dashboard: "navigation.dashboard",
  ...sections,
  files: "navigation.files",
  notes: "navigation.notes",
  "edit-project": "projects.edit",
  users: "users.title",
} as const;

export type PageId = keyof typeof pageLabels;

export function sectionFor(
  folders: Folder[] | ReadonlyMap<string, Folder>,
  id: string | null,
): SectionKey | null {
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const folder = Array.isArray(folders) ? folders.find((f) => f.id === id) : folders.get(id);
    if (!folder) {
      return null;
    }

    if (folder.sectionKey) {
      return folder.sectionKey;
    }

    id = folder.parentId;
  }

  return null;
}

export function pageSection(page: PageId): SectionKey | null {
  return page in sections ? (page as SectionKey) : null;
}

export function folderLabel(folder: Folder): string {
  return folder.sectionKey
    ? t(sections[folder.sectionKey])
    : folder.parentId === null
      ? t("folders.root")
      : folder.name;
}

// Traverse only the supplied (authorized) tree and tolerate malformed cycles.
export function folderSubtree(folders: Folder[], rootId: string | null): Set<string> {
  const result = new Set<string>();
  if (!rootId || !folders.some((folder) => folder.id === rootId)) {
    return result;
  }

  const children = new Map<string, string[]>();
  for (const folder of folders) {
    if (folder.parentId) {
      const siblings = children.get(folder.parentId) ?? [];
      siblings.push(folder.id);
      children.set(folder.parentId, siblings);
    }
  }

  const queue = [rootId];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (result.has(id)) {
      continue;
    }

    result.add(id);
    queue.push(...(children.get(id) ?? []));
  }

  return result;
}

export function searchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

const roleKeys = {
  Owner: "roles.owner",
  Admin: "roles.admin",
  Client: "roles.client",
} as const;

export function roleLabel(role: string): string {
  return Object.hasOwn(roleKeys, role) ? t(roleKeys[role as keyof typeof roleKeys]) : role;
}
