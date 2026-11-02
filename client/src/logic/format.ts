import { locale, t } from "../i18n";
import type { FileContent, ProjectFile } from "../types/portal";

export const date = (s: string | null | undefined) =>
  s
    ? new Intl.DateTimeFormat(locale(), {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Bucharest",
      }).format(new Date(s))
    : t("common.undetermined");

export const download = (
  projectId: string,
  file: ProjectFile,
  _content: FileContent,
  inline = false,
) => `/api/projects/${projectId}/files/${file.id}/content${inline ? "?inline=true" : ""}`;
