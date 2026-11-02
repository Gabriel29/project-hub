import {
  File,
  FileArchive,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileType2,
  FileVideo,
  Image,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";

export function FileTypeIcon({
  contentType,
  fileName,
  size = 30,
}: {
  contentType: string;
  fileName: string;
  size?: number;
}) {
  useTranslation();
  const ext = fileName.split(".").pop()?.toLowerCase();
  const [Icon, label] = contentType.startsWith("image/")
    ? [Image, t("files.image")]
    : contentType === "application/pdf" || ext === "pdf"
      ? [FileText, "PDF"]
      : ["doc", "docx", "odt"].includes(ext ?? "")
        ? [FileType2, t("files.wordDocument")]
        : ["xls", "xlsx", "csv", "ods"].includes(ext ?? "")
          ? [FileSpreadsheet, t("files.spreadsheet")]
          : contentType.startsWith("video/")
            ? [FileVideo, "Video"]
            : contentType.startsWith("audio/")
              ? [FileAudio, "Audio"]
              : ["zip", "rar", "7z", "gz"].includes(ext ?? "")
                ? [FileArchive, t("files.archive")]
                : [File, t("files.file")];

  return <Icon size={size} aria-label={label} />;
}
