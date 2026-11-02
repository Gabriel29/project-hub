import { useCallback } from "react";

import { t } from "../i18n";
import { folderLabel } from "../logic/navigation";
import { useScopedResource } from "../logic/useScopedResource";
import { projectsApi } from "../services/api/projects";
import { Button } from "./Button";

export function FolderPicker({
  projectId,
  userId,
  value,
  exclude,
  onChange,
}: {
  projectId: string;
  userId: string;
  value: string;
  exclude?: string;
  onChange: (id: string) => void;
}) {
  const load = useCallback(() => projectsApi.contents(projectId, value), [projectId, value]);
  const listing = useScopedResource(value ? `${userId}/${projectId}/move/${value}` : "", load);

  return (
    <div>
      <p>{t("files.newLocation")}</p>
      {listing.loading && <p role="status">{t("projects.loading")}</p>}
      {listing.error && (
        <div role="alert">
          {listing.error}
          <Button onClick={() => void listing.refresh().catch(() => {})}>
            {t("common.retry")}
          </Button>
        </div>
      )}
      {listing.value && (
        <>
          <div className="folder-breadcrumb">
            {listing.value.breadcrumbs.map((folder) => (
              <Button key={folder.id} secondary onClick={() => onChange(folder.id)}>
                {folderLabel(folder)}
              </Button>
            ))}
          </div>
          <div className="folder-grid">
            {listing.value.folders
              .filter((folder) => folder.id !== exclude)
              .map((folder) => (
                <Button key={folder.id} secondary onClick={() => onChange(folder.id)}>
                  {folderLabel(folder)}
                </Button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
