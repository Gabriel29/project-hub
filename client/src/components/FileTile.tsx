import "./FileTile.css";

import { Folder as FolderIcon, FolderOpen, MoreHorizontal, UserRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";
import { download } from "../logic/format";
import { folderLabel } from "../logic/navigation";
import type { Portal } from "../logic/usePortal";
import { filesApi } from "../services/api/files";
import type { Folder, ProjectFile } from "../types/portal";
import { Button } from "./Button";
import { Field } from "./Field";
import { FileTypeIcon } from "./FileTypeIcon";
import { FolderPicker } from "./FolderPicker";
import { Modal } from "./Modal";

export function FileTile({
  context: v,
  file,
  folder,
  hideMenu = false,
  location,
  onOpenLocation,
}: {
  context: Portal;
  file?: ProjectFile;
  folder?: Folder;
  hideMenu?: boolean;
  location?: string;
  onOpenLocation?: () => void;
}) {
  useTranslation();
  const [dialog, setDialog] = useState<"move" | "delete" | "rename" | null>(null);
  const rootId = v.project.detail?.rootFolderId;
  const [target, setTarget] = useState(file?.folderId ?? folder?.parentId ?? rootId ?? "");
  const item = file ?? folder!;
  const name = file?.title ?? folderLabel(folder!);
  const canRename = v.session.isManager && (!!file || (!!folder?.parentId && !folder.sectionKey));
  const open = () => {
    if (folder) {
      v.navigation.setActiveFolder(folder.id);
      v.navigation.setSearch("");
    } else if (file) {
      if (
        file.content.contentType.startsWith("image/") ||
        file.content.contentType === "application/pdf"
      ) {
        v.navigation.setPreviewGalleryId(null);
        v.navigation.setPreviewFile(file);
        v.navigation.setModal(file.content.contentType.startsWith("image/") ? "photo" : "pdf");
      } else {
        window.open(
          download(v.projects.selectedId, file, file.content),
          "_blank",
          "noopener,noreferrer",
        );
      }
    }
  };

  return (
    <div
      className="document-tile"
      data-kind={folder ? (folder.sectionKey ? "default-folder" : "folder") : "file"}
    >
      <button
        className="tile-open"
        aria-label={file ? name : undefined}
        title={location}
        onClick={open}
      >
        {folder ? (
          folder.sectionKey ? (
            <span
              className="shared-folder-icon"
              role="img"
              aria-label={t("files.sharedWithClient")}
            >
              <FolderIcon size={30} aria-hidden="true" />
              <UserRound className="shared-folder-person" size={15} aria-hidden="true" />
            </span>
          ) : (
            <FolderIcon size={30} />
          )
        ) : file ? (
          <FileTypeIcon contentType={file.content.contentType} fileName={file.content.fileName} />
        ) : null}
        <span>{name}</span>
      </button>
      {onOpenLocation && (
        <button
          className="icon-button"
          onClick={onOpenLocation}
          aria-label={t("files.openLocationFor", { name })}
          title={t("files.openLocation")}
        >
          <FolderOpen size={18} />
        </button>
      )}
      {!hideMenu && (
        <details className="file-menu">
          <summary aria-label={t("common.itemMenu", { name })}>
            <MoreHorizontal size={20} />
          </summary>
          <div>
            <button onClick={open}>{t("common.open")}</button>
            {file && (
              <a href={download(v.projects.selectedId, file, file.content)}>
                {t("common.download")}
              </a>
            )}
            {canRename && (
              <button
                disabled={v.feedback.busy}
                onClick={(event) => {
                  const menu = event.currentTarget.closest("details");
                  menu?.querySelector("summary")?.focus();
                  menu?.removeAttribute("open");
                  v.feedback.setError("");
                  setDialog("rename");
                }}
              >
                {t("common.rename")}
              </button>
            )}
            <button
              disabled={!v.session.isManager || !!folder?.sectionKey}
              onClick={() => setDialog("move")}
            >
              {" "}
              {t("common.move")}{" "}
            </button>
            <button
              disabled={!v.session.isManager || !!folder?.sectionKey || v.feedback.busy}
              onClick={() => setDialog("delete")}
            >
              {" "}
              {t("common.delete")}{" "}
            </button>
          </div>
        </details>
      )}
      {dialog === "rename" && canRename && (
        <Modal
          title={t(folder ? "folders.renameNamed" : "files.renameNamed", { name })}
          onClose={() => {
            if (!v.feedback.busy) {
              setDialog(null);
            }
          }}
        >
          {v.feedback.error && (
            <p className="alert" role="alert">
              {v.feedback.error}
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
              if (!title) {
                v.feedback.setError(
                  t(folder ? "errors.invalidFolderName" : "errors.invalidFileName"),
                );

                return;
              }

              void v.project.run(
                async () => {
                  if (folder) {
                    await filesApi.renameFolder(v.projects.selectedId, folder.id, title);
                  } else if (file) {
                    await filesApi.rename(v.projects.selectedId, file.id, title);
                  }

                  setDialog(null);
                },
                t(folder ? "folders.renamed" : "files.renamed"),
                false,
              );
            }}
          >
            <Field label={t("common.name")}>
              <input name="title" defaultValue={name} required maxLength={folder ? 120 : 200} />
            </Field>
            <div className="row-buttons">
              <Button type="submit" disabled={v.feedback.busy}>
                {t("common.save")}
              </Button>
              <Button secondary disabled={v.feedback.busy} onClick={() => setDialog(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "move" && (
        <Modal title={t("files.moveNamed", { name })} onClose={() => setDialog(null)}>
          <p className="muted"> {t("files.sharingNotice")} </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void v.project.run(
                async () => {
                  if (folder) {
                    await filesApi.moveFolder(v.projects.selectedId, item.id, target || null);
                  } else {
                    await filesApi.move(v.projects.selectedId, item.id, target || null);
                  }

                  setDialog(null);
                },
                t("files.moved"),
                false,
              );
            }}
          >
            <FolderPicker
              projectId={v.projects.selectedId}
              userId={v.session.user!.id}
              value={target}
              exclude={folder?.id}
              onChange={setTarget}
            />
            <Button type="submit" disabled={v.feedback.busy || !target}>
              {" "}
              {t("files.moveHere")}{" "}
            </Button>
          </form>
        </Modal>
      )}
      {dialog === "delete" && (
        <Modal title={t("files.deleteNamed", { name })} onClose={() => setDialog(null)}>
          <p>{folder ? t("folders.deleteWarning") : t("files.deleteWarning")}</p>
          <div className="row-buttons">
            <Button secondary onClick={() => setDialog(null)}>
              {" "}
              {t("common.cancel")}{" "}
            </Button>
            <Button
              disabled={v.feedback.busy}
              onClick={() => {
                void v.project.run(
                  async () => {
                    if (folder) {
                      await filesApi.deleteFolder(v.projects.selectedId, item.id);
                    } else {
                      await filesApi.delete(v.projects.selectedId, item.id);
                    }

                    setDialog(null);
                  },
                  t("files.deleted"),
                  false,
                );
              }}
            >
              {" "}
              {t("common.confirmDeletion")}{" "}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
