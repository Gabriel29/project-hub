import type { CalendarEntry, ProjectFile } from "../types/portal";

export function activityPhotos(entry: CalendarEntry, files: ProjectFile[]) {
  const ids = entry.photoIds?.length
    ? entry.photoIds
    : entry.photoContentId
      ? [entry.photoContentId]
      : [];

  return [...new Set(ids)].flatMap((id) => {
    const file = files.find((f) => f.content.id === id);

    return file?.content.contentType.startsWith("image/") ? [file] : [];
  });
}
