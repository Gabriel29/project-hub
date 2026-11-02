import "./NotesPage.css";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../components/Button";
import { Empty } from "../components/Empty";
import { Field } from "../components/Field";
import { Modal } from "../components/Modal";
import { t } from "../i18n";
import { date } from "../logic/format";
import { notesApi } from "../services/api/notes";
import type { Note } from "../types/portal";
import type { PageContext } from "./PageContext";

export function NotesPage(v: PageContext) {
  useTranslation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Note | "new" | null>(null);
  const [viewing, setViewing] = useState<Note | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    notesApi
      .list(v.projects.selectedId)
      .then((data) => {
        if (active) {
          setNotes(data);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [v.projects.selectedId]);

  useEffect(() => {
    if (!menuId) {
      return;
    }

    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest(".note-actions")) {
        setMenuId(null);
      }
    };

    document.addEventListener("pointerdown", closeOutside);

    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [menuId]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setNotes(await notesApi.list(v.projects.selectedId));
      setEditing(null);
      setRemoving(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="notes-workspace">
      <div className="section-toolbar">
        <p className="muted"> {t("notes.privateHint")} </p>
        <Button onClick={() => setEditing("new")}>{t("notes.new")}</Button>
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">{t("notes.loading")}</p>
      ) : (
        notes.length === 0 && <Empty title={t("notes.empty")} detail={t("notes.emptyHint")} />
      )}
      <div className="notes-grid">
        {notes.map((note) => (
          <article className="record-card note-card" key={note.id}>
            <button
              className="note-preview"
              type="button"
              onClick={() => setViewing(note)}
              aria-label={note.title}
              aria-haspopup="dialog"
            >
              <small>
                {t("common.updated")} {date(note.updatedAt)}
              </small>
              <h2>{note.title}</h2>
              <p>{note.body}</p>
            </button>
            <div
              className="note-actions"
              onBlur={(event) => {
                if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
                  setMenuId(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setMenuId(null);
                  event.currentTarget.querySelector("button")?.focus();
                  event.stopPropagation();
                }
              }}
            >
              <button
                type="button"
                className="icon-button"
                aria-label={t("common.itemMenu", { name: note.title })}
                aria-expanded={menuId === note.id}
                onClick={(event) => {
                  event.currentTarget.focus();
                  setMenuId(menuId === note.id ? null : note.id);
                }}
              >
                <MoreHorizontal size={20} />
              </button>
              {menuId === note.id && (
                <div className="note-action-popover">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.currentTarget
                        .closest(".note-actions")
                        ?.querySelector("button")
                        ?.focus();
                      setMenuId(null);
                      setEditing(note);
                    }}
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.currentTarget
                        .closest(".note-actions")
                        ?.querySelector("button")
                        ?.focus();
                      setMenuId(null);
                      setRemoving(note);
                    }}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {viewing && (
        <Modal title={viewing.title} onClose={() => setViewing(null)}>
          <small>
            {t("common.updated")} {date(viewing.updatedAt)}
          </small>
          <p className="pre-text note-full-body">{viewing.body}</p>
        </Modal>
      )}
      {editing && (
        <Modal
          title={editing === "new" ? t("notes.new") : t("notes.edit")}
          onClose={() => {
            if (!busy) {
              setEditing(null);
            }
          }}
        >
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void run(() =>
                notesApi.save(
                  v.projects.selectedId,
                  { title: form.get("title"), body: form.get("body") },
                  editing === "new" ? undefined : editing.id,
                ),
              );
            }}
          >
            <Field label={t("common.title")}>
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={editing === "new" ? "" : editing.title}
              />
            </Field>
            <Field label={t("notes.note")}>
              <textarea
                name="body"
                rows={10}
                maxLength={20000}
                defaultValue={editing === "new" ? "" : editing.body}
              />
            </Field>
            <div className="row-buttons">
              <Button type="submit" disabled={busy}>
                {" "}
                {t("common.save")}{" "}
              </Button>
              <Button secondary disabled={busy} onClick={() => setEditing(null)}>
                {" "}
                {t("common.cancel")}{" "}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {removing && (
        <Modal
          title={t("notes.delete")}
          onClose={() => {
            if (!busy) {
              setRemoving(null);
            }
          }}
        >
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <p>{t("common.deleteNamedConfirmation", { name: removing.title })}</p>
          <div className="row-buttons">
            <Button
              disabled={busy}
              onClick={() => void run(() => notesApi.delete(v.projects.selectedId, removing.id))}
            >
              {" "}
              {t("common.confirmDeletion")}{" "}
            </Button>
            <Button secondary disabled={busy} onClick={() => setRemoving(null)}>
              {" "}
              {t("common.cancel")}{" "}
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
