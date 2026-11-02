import "./DocumentsPage.css";

import { ChevronRight, FolderPlus, Search, Upload } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../components/Button";
import { Empty } from "../components/Empty";
import { FileTile } from "../components/FileTile";
import { locale, t } from "../i18n";
import { folderLabel, searchText } from "../logic/navigation";
import type { PageContext } from "./PageContext";

export function DocumentsPage(v: PageContext) {
  useTranslation();
  const { folders } = v.project;
  const { isManager: admin } = v.session;
  const { search, setSearch, openUpload, setModal } = v.navigation;
  const folderById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  );
  const folderId = v.project.currentFolder;
  const ancestors = v.project.listing?.breadcrumbs ?? [];
  const query = searchText(search);
  const searching = query.length > 0;
  const children = [...(v.project.listing?.folders ?? [])].sort((a, b) =>
    folderLabel(a).localeCompare(folderLabel(b), locale()),
  );
  const visible = [...(v.project.listing?.files ?? [])].sort((a, b) =>
    a.title.localeCompare(b.title, locale()),
  );
  const resultLocation = (id: string | null) => {
    const names: string[] = [];
    const seen = new Set<string>();
    let folder = folderById.get(id ?? "");
    while (folder && !seen.has(folder.id)) {
      seen.add(folder.id);
      names.unshift(folderLabel(folder));
      if (folder.id === folderId) {
        break;
      }

      folder = folderById.get(folder.parentId ?? "");
    }

    return names.join(" / ");
  };

  const splitRoot =
    !searching &&
    v.navigation.page === "files" &&
    folders.some((f) => f.id === folderId && f.parentId === null);
  const shared = splitRoot
    ? (v.project.detail?.sections ?? []).flatMap((section) =>
        children.filter((f) => f.sectionKey === section.key),
      )
    : [];
  const ordinary = splitRoot ? children.filter((f) => !f.sectionKey) : children;

  return (
    <>
      <div className="section-toolbar">
        <label className="search">
          <Search size={17} />
          <input
            aria-label={t("search.documents")}
            placeholder={t("search.placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="row-buttons">
          {admin && !v.project.resourceLoading && !v.project.resourceError && v.project.listing && (
            <Button secondary onClick={() => setModal("new-folder")}>
              <FolderPlus size={17} /> {t("folders.new")}{" "}
            </Button>
          )}
          {v.project.canUpload && (
            <Button onClick={() => openUpload()}>
              <Upload size={17} /> {t("files.upload")}{" "}
            </Button>
          )}
        </div>
      </div>
      {v.project.resourceLoading && <p role="status">{t("projects.loading")}</p>}
      {v.project.resourceError && (
        <div role="alert">
          {v.project.resourceError}
          <Button
            onClick={() =>
              void v.project.refresh().catch((error: Error) => v.feedback.setError(error.message))
            }
          >
            {t("common.retry")}
          </Button>
        </div>
      )}
      {ancestors.length > 0 &&
        (v.navigation.page === "files" || folderId !== v.project.sectionRoot?.id) && (
          <div className="folder-breadcrumb">
            {ancestors.map((f, i) => (
              <span key={f.id}>
                {i > 0 && <ChevronRight size={14} />}
                <button
                  onClick={() => {
                    v.navigation.setActiveFolder(f.id);
                    setSearch("");
                  }}
                >
                  {folderLabel(f)}
                </button>
              </span>
            ))}
          </div>
        )}
      {searching && (
        <p className="muted" role="status">
          {t("search.locationSummary", {
            location: ancestors.length
              ? folderLabel(ancestors[ancestors.length - 1])
              : t("files.currentLocation"),
            total: children.length + visible.length,
          })}
        </p>
      )}
      {shared.length > 0 && (
        <section className="shared-folder-section" aria-label={t("folders.sharedWithClient")}>
          <div
            className="document-tiles shared-folder-row"
            role="group"
            aria-label={t("folders.defaults")}
          >
            {shared.map((f) => (
              <FileTile key={f.id} context={v} folder={f} hideMenu />
            ))}
          </div>
        </section>
      )}
      <div className="folder-grid document-tiles">
        {ordinary.map((f) => (
          <FileTile
            key={f.id}
            context={v}
            folder={f}
            location={searching ? resultLocation(f.parentId) : undefined}
          />
        ))}
        {visible.map((f) => (
          <FileTile
            key={f.id}
            context={v}
            file={f}
            location={searching ? resultLocation(f.folderId) : undefined}
            onOpenLocation={
              searching
                ? () => {
                    v.navigation.setActiveFolder(f.folderId);
                    setSearch("");
                  }
                : undefined
            }
          />
        ))}
      </div>
      {!v.project.resourceLoading &&
        !v.project.resourceError &&
        !children.length &&
        !visible.length && (
          <Empty
            title={searching ? t("search.noResults") : t("files.empty")}
            detail={
              searching
                ? t("search.tryAnotherName")
                : !v.project.canUpload
                  ? t("files.managedByTeam")
                  : v.project.sectionKey
                    ? t("files.uploadFirstDocument")
                    : t("files.emptyHint")
            }
          />
        )}
    </>
  );
}
