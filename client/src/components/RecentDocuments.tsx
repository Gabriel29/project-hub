import "./RecentDocuments.css";

import { ArrowRight, Download } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";
import { download } from "../logic/format";
import { sectionFor, sections } from "../logic/navigation";
import type { PageContext } from "../pages/PageContext";
import { FileTypeIcon } from "./FileTypeIcon";

export function RecentDocuments({ context: v }: { context: PageContext }) {
  useTranslation();
  // The API supplies authorized files. Limit this view to files in accessible tabs,
  // excluding Progress and photos, its descendants, and private File Manager content.
  const folderById = useMemo(
    () => new Map(v.project.folders.map((folder) => [folder.id, folder])),
    [v.project.folders],
  );
  const recent = useMemo(
    () =>
      v.project.files
        .flatMap((file) => {
          const section = sectionFor(folderById, file.folderId);
          const folder = folderById.get(file.folderId ?? "");

          return section &&
            section !== "progress" &&
            (v.session.isManager || folder?.clientVisible === true)
            ? [{ file, section }]
            : [];
        })
        .sort((a, b) => Date.parse(b.file.content.createdAt) - Date.parse(a.file.content.createdAt))
        .slice(0, 6),
    [v.project.files, folderById, v.session.isManager],
  );

  return (
    <section className="flat-section recent-documents">
      <div className="card-heading">
        <h3>{t("files.recentDocuments")}</h3>
        {v.session.user.roles.includes("Owner") && (
          <button className="text-button" onClick={() => v.navigation.go("files")}>
            {t("common.viewAll")} <ArrowRight size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      {recent.map(({ file, section }) => (
        <div className="recent-document-link" key={file.id}>
          <a
            className="recent-document-open"
            href={download(v.projects.selectedId, file, file.content)}
            download={
              file.content.contentType.startsWith("image/") ||
              file.content.contentType === "application/pdf"
                ? undefined
                : file.content.fileName
            }
            aria-label={t("files.openNamed", { name: file.title })}
            onClick={(event) => {
              const type = file.content.contentType;
              if (!type.startsWith("image/") && type !== "application/pdf") {
                return;
              }

              // Preserve the browser's normal modified-click behavior.
              if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
                return;
              }

              event.preventDefault();
              v.navigation.setPreviewGalleryId(null);
              v.navigation.setPreviewFile(file);
              v.navigation.setModal(type.startsWith("image/") ? "photo" : "pdf");
            }}
          >
            <FileTypeIcon
              contentType={file.content.contentType}
              fileName={file.content.fileName}
              size={22}
            />
            <span>
              <strong>{file.title}</strong>
              <small>{t(sections[section])}</small>
            </span>
          </a>
          <div className="recent-document-actions">
            <a
              className="icon-button"
              href={download(v.projects.selectedId, file, file.content)}
              download={file.content.fileName}
              aria-label={t("files.downloadNamed", { name: file.title })}
              title={t("common.download")}
            >
              <Download size={18} aria-hidden="true" />
            </a>
            <button
              className="icon-button"
              aria-label={t("files.openSectionFor", {
                section: t(sections[section]),
                name: file.title,
              })}
              title={t(sections[section])}
              onClick={() => {
                v.navigation.go(section);
                v.navigation.setActiveFolder(file.folderId);
              }}
            >
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      {!recent.length && <p className="muted">{t("files.emptySharedDocuments")}</p>}
    </section>
  );
}
