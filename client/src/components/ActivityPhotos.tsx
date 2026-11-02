import "./ActivityPhotos.css";

import { useTranslation } from "react-i18next";

import { t } from "../i18n";
import { activityPhotos } from "../logic/activityPhotos";
import { download } from "../logic/format";
import type { PageContext } from "../pages/PageContext";
import type { CalendarEntry } from "../types/portal";

export function ActivityPhotos({
  entry,
  context: v,
}: {
  entry: CalendarEntry;
  context: PageContext;
}) {
  useTranslation();
  const photos = activityPhotos(entry, v.project.files);
  if (!photos.length) {
    return null;
  }

  const visible = photos.slice(0, 3);
  const remaining = photos.length - visible.length;

  return (
    <div
      className="activity-photos"
      role="group"
      aria-label={t("photos.photosNamed", { name: entry.title })}
    >
      <div className="activity-photo-preview" data-count={visible.length}>
        {visible.map((file, index) => {
          const more = index === visible.length - 1 && remaining > 0;

          return (
            <button
              key={file.id}
              className="activity-photo-button"
              aria-label={
                more
                  ? t("photos.openNamedWithMore", { name: file.title, count: remaining })
                  : t("photos.openNamed", { name: file.title })
              }
              onClick={() => {
                v.navigation.setPreviewGalleryId(entry.id);
                v.navigation.setPreviewFile(file);
                v.navigation.setModal("photo");
              }}
            >
              <img
                src={download(v.projects.selectedId, file, file.content, true)}
                alt={file.title}
                loading="lazy"
              />
              {more && (
                <span className="activity-photo-more" aria-hidden="true">
                  +{remaining}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {photos.length > 1 && (
        <span className="activity-photo-count">
          {t("photos.galleryCount", { count: photos.length })}
        </span>
      )}
    </div>
  );
}
