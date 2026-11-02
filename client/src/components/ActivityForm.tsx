import "./ActivityForm.css";

import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";
import { download } from "../logic/format";
import type { Portal } from "../logic/usePortal";
import { progressApi } from "../services/api/progress";
import { Button } from "./Button";
import { Field } from "./Field";
import { FileTypeIcon } from "./FileTypeIcon";

export function ActivityForm({
  portal: v,
  save,
}: {
  portal: Portal;
  save: (form: FormData) => Promise<void>;
}) {
  useTranslation();
  const entry = v.navigation.editingEntry;
  const [ids, setIds] = useState(
    entry?.photoIds?.length ? entry.photoIds : entry?.photoContentId ? [entry.photoContentId] : [],
  );
  const [pending, setPending] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const urls = pending.map((file) => URL.createObjectURL(file));
    setPreviews(urls);

    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [pending]);
  const attached = ids
    .map((id) => v.project.files.find((f) => f.content.id === id))
    .filter((f) => !!f);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        ids.forEach((id) => form.append("photoContentId", id));
        pending.forEach((file) => form.append("photo", file));
        void save(form);
      }}
    >
      <Field label={t("common.title")}>
        <input name="title" required maxLength={200} defaultValue={entry?.title ?? ""} />
      </Field>
      <Field label={t("activity.description")}>
        <textarea name="details" rows={4} maxLength={4000} defaultValue={entry?.details ?? ""} />
      </Field>
      <section className="attachment-editor" aria-label={t("files.add")}>
        <div className="attachment-editor-heading">
          <strong>{t("files.add")}</strong>
          <small>{ids.length + pending.length} / 20</small>
        </div>
        <p className="muted">{t("activity.attachmentsLimit")}</p>
        <input
          ref={input}
          className="attachment-file-input"
          tabIndex={-1}
          aria-label={t("activity.addFilesLimit")}
          multiple
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx"
          disabled={v.feedback.busy}
          onChange={(e) => {
            const added = Array.from(e.target.files ?? []);
            if (ids.length + pending.length + added.length > 20) {
              v.feedback.setError(t("activity.fileLimit"));
            } else {
              setPending([...pending, ...added]);
              v.feedback.setError("");
            }

            e.target.value = "";
          }}
        />
        <div className="attachment-editor-grid">
          {attached.map((file) => (
            <div className="attachment-preview" key={file.id}>
              {file.content.contentType.startsWith("image/") ? (
                <img
                  src={download(v.projects.selectedId, file, file.content, true)}
                  alt={file.title}
                />
              ) : (
                <FileTypeIcon
                  contentType={file.content.contentType}
                  fileName={file.content.fileName}
                />
              )}
              <span>{file.title}</span>
              <button
                type="button"
                className="attachment-remove"
                aria-label={t("files.removeNamed", { name: file.title })}
                disabled={v.feedback.busy}
                onClick={() => setIds(ids.filter((id) => id !== file.content.id))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {pending.map((file, i) => (
            <div className="attachment-preview" key={`${file.name}-${i}`}>
              {file.type.startsWith("image/") ? (
                <img src={previews[i]} alt={file.name} />
              ) : (
                <FileTypeIcon contentType={file.type} fileName={file.name} />
              )}
              <span>{file.name}</span>
              <button
                type="button"
                className="attachment-remove"
                aria-label={t("files.removeNamed", { name: file.name })}
                disabled={v.feedback.busy}
                onClick={() => setPending(pending.filter((_, index) => index !== i))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="attachment-add"
            disabled={v.feedback.busy || ids.length + pending.length >= 20}
            onClick={() => input.current?.click()}
          >
            <Plus size={24} />
            {t("files.add")}
          </button>
        </div>
      </section>
      {confirming ? (
        <div className="activity-delete-confirm" role="alert">
          <p>{t("activity.deleteConfirmation")}</p>
          <div className="row-buttons">
            <Button secondary disabled={v.feedback.busy} onClick={() => setConfirming(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={v.feedback.busy}
              onClick={() =>
                void v.project.run(
                  () => progressApi.deleteActivity(v.projects.selectedId, entry!.id),
                  t("activity.deleted"),
                )
              }
            >
              {t("common.confirmDeletion")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="activity-form-actions">
          <Button type="submit" disabled={v.feedback.busy}>
            {t("activity.save")}
          </Button>
          {entry && (
            <Button secondary disabled={v.feedback.busy} onClick={() => setConfirming(true)}>
              <Trash2 size={16} />
              {t("activity.delete")}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
