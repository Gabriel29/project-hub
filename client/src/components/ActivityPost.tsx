import "./ActivityPost.css";

import { CalendarDays, Paperclip, Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";
import { date } from "../logic/format";
import type { PageContext } from "../pages/PageContext";
import type { CalendarEntry } from "../types/portal";
import { ActivityPhotos } from "./ActivityPhotos";
import { FileTile } from "./FileTile";

export function ActivityPost({
  entry,
  context: v,
  compact = false,
}: {
  entry: CalendarEntry;
  context: PageContext;
  compact?: boolean;
}) {
  useTranslation();
  const [expanded, setExpanded] = useState(false);
  const documents = v.project.files.filter(
    (f) => entry.photoIds?.includes(f.content.id) && !f.content.contentType.startsWith("image/"),
  );
  const canCollapse =
    compact && (entry.details.length > 240 || entry.details.split("\n").length > 4);
  const descriptionId = `activity-description-${entry.id}`;

  return (
    <article
      className={`activity-post ${compact ? "news-row activity-post-compact" : "calendar-entry activity-post-full"}`}
      aria-label={entry.title}
    >
      <div className="activity-body">
        <header className="activity-meta">
          <time dateTime={entry.occurredAt}>
            <CalendarDays size={14} aria-hidden="true" />
            {date(entry.occurredAt)}
          </time>
        </header>
        <div className="activity-title-row">
          <h3>{entry.title}</h3>
          {!compact && v.session.isManager && (
            <div className="activity-title-actions">
              <button
                className="text-button"
                onClick={() => {
                  v.navigation.setEditingEntry(entry);
                  v.navigation.setModal("edit-update");
                }}
              >
                <Pencil size={14} aria-hidden="true" />
                {t("activity.edit")}{" "}
              </button>
            </div>
          )}
        </div>
        <p
          id={descriptionId}
          className={`pre-text ${canCollapse && !expanded ? "activity-excerpt" : ""}`}
        >
          {entry.details}
        </p>
        {canCollapse && (
          <button
            className="text-button activity-read-more"
            aria-expanded={expanded}
            aria-controls={descriptionId}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? t("common.showLess") : t("common.readMore")}
          </button>
        )}
        <ActivityPhotos entry={entry} context={v} />
        {!compact && documents.length > 0 && (
          <section
            className="activity-attachments"
            aria-label={t("files.documentsNamed", { name: entry.title })}
          >
            <span className="activity-attachment-label">
              <Paperclip size={14} aria-hidden="true" />
              {t("files.attachedDocuments")}
            </span>
            <div className="document-tiles">
              {documents.map((f) => (
                <FileTile key={f.id} context={v} file={f} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
