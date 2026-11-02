import "./PhotoViewer.css";

import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useEffect, useEffectEvent, useRef } from "react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";
import { download } from "../logic/format";
import type { ProjectFile } from "../types/portal";

export function PhotoViewer({
  photos,
  selected,
  select,
  project,
  title,
  carousel = photos.length > 1,
}: {
  photos: ProjectFile[];
  selected: ProjectFile;
  select: (file: ProjectFile) => void;
  project: string;
  title?: string;
  carousel?: boolean;
}) {
  useTranslation();
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const index = Math.max(
    0,
    photos.findIndex((f) => f.id === selected.id),
  );
  const file = photos[index];
  const multiple = carousel && photos.length > 1;

  function move(delta: number) {
    const next = Math.max(0, Math.min(photos.length - 1, index + delta));
    if (photos[next]) {
      select(photos[next]);
    }
  }

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) {
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(-1);
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      move(1);
    }

    if (e.key === "Home") {
      e.preventDefault();
      select(photos[0]);
    }

    if (e.key === "End") {
      e.preventDefault();
      select(photos[photos.length - 1]);
    }
  });
  useEffect(() => {
    if (!multiple) {
      return;
    }

    const key = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener("keydown", key);

    return () => document.removeEventListener("keydown", key);
  }, [multiple]);
  if (!file) {
    return <p className="muted">{t("photos.unavailable")}</p>;
  }

  return (
    <div
      className={carousel ? "photo-viewer photo-carousel" : "photo-viewer"}
      role={carousel ? "region" : undefined}
      aria-roledescription={carousel ? t("photos.carousel") : undefined}
      aria-label={carousel ? t("photos.galleryNamed", { name: title ?? file.title }) : undefined}
    >
      <div
        className="photo-viewer-image"
        role={multiple ? "group" : undefined}
        aria-roledescription={multiple ? t("photos.slide") : undefined}
        aria-label={
          multiple ? t("photos.position", { index: index + 1, total: photos.length }) : undefined
        }
        onPointerDown={(e) => {
          gesture.current = e.pointerType === "touch" ? { x: e.clientX, y: e.clientY } : null;
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
        onPointerUp={(e) => {
          const start = gesture.current;
          gesture.current = null;
          if (!start || !multiple) {
            return;
          }

          const dx = e.clientX - start.x;
          if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
            move(dx < 0 ? 1 : -1);
          }
        }}
      >
        <img
          className="full-photo"
          alt={file.title}
          src={download(project, file, file.content, true)}
          draggable={false}
        />
        <a
          className="photo-download"
          href={download(project, file, file.content)}
          aria-label={t("photos.download")}
          title={t("photos.download")}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <Download size={20} aria-hidden="true" />
        </a>
      </div>
      {multiple && (
        <div className="activity-carousel-controls">
          <button
            className="icon-button"
            aria-label={t("photos.previous")}
            disabled={index === 0}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <span className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
            {index + 1} / {photos.length}
          </span>
          <button
            className="icon-button"
            aria-label={t("photos.next")}
            disabled={index === photos.length - 1}
            onClick={() => move(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
