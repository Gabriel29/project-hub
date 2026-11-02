import "./PortalDialogs.css";

import { Copy, ShieldCheck, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";
import { activityPhotos } from "../logic/activityPhotos";
import { download } from "../logic/format";
import { formValues } from "../logic/formValues";
import { folderLabel, sectionFor, sections } from "../logic/navigation";
import { useDialogActions } from "../logic/useDialogActions";
import type { Portal } from "../logic/usePortal";
import { AccountSettings } from "./AccountSettings";
import { ActivityForm } from "./ActivityForm";
import { Button } from "./Button";
import { CalendarForm } from "./CalendarForm";
import { CreateUser } from "./CreateUser";
import { Field } from "./Field";
import { Modal } from "./Modal";
import { PhotoViewer } from "./PhotoViewer";
import { ProjectForm } from "./ProjectForm";

export function PortalDialogs(v: Portal) {
  useTranslation();

  const { files, data: p } = v.project;
  const { isManager: admin, user } = v.session;
  const { modal, setModal, previewFile } = v.navigation;
  const { error, busy, setNotice } = v.feedback;
  const { selectedId: selected } = v.projects;
  const { accessLink: link } = v.people;
  const actions = useDialogActions(v);
  const gallery = v.project.updates.find((e) => e.id === v.navigation.previewGalleryId);
  const photos = v.navigation.previewGalleryId
    ? gallery
      ? activityPhotos(gallery, files)
      : []
    : previewFile
      ? [previewFile]
      : [];
  if (!user) {
    return null;
  }

  return (
    <>
      {modal && (
        <Modal
          title={
            (
              {
                "new-folder": t("folders.new"),
                stages: t("stages.title"),
                "new-update": t("activity.new"),
                "edit-update": t("activity.edit"),
                status: t("stages.status"),
                "new-project": t("projects.create"),
                upload: t("files.upload"),
                pdf: t("files.pdfDocument"),
                "new-user": t("users.add"),
                link: t("links.secureLink"),
                members: t("projects.access"),
                calendar: t("stages.calendar"),
                account: t("account.settings"),
                photo: t("photos.photo"),
              } as Record<string, string>
            )[modal] ?? modal
          }
          hideTitle={modal === "photo"}
          onClose={() => setModal("")}
        >
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          {modal === "new-project" && (
            <ProjectForm portal={v} editing={false} save={actions.saveProject} />
          )}
          {modal === "upload" && v.project.canUpload && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void actions.upload(new FormData(e.currentTarget));
              }}
            >
              <p className="muted">
                {v.project.sectionKey || sectionFor(v.project.folders, v.project.currentFolder)
                  ? t("files.sharedFolderNotice")
                  : t("files.privateFolderNotice")}
              </p>
              <Field label={t("files.documentOrPhotoName")}>
                <input name="title" required maxLength={200} />
              </Field>
              {v.navigation.page === "files" && (
                <p className="upload-destination">
                  {" "}
                  {t("files.destination")}{" "}
                  {(v.project.folders.find((f) => f.id === v.project.currentFolder)
                    ? folderLabel(v.project.folders.find((f) => f.id === v.project.currentFolder)!)
                    : undefined) ??
                    (v.project.sectionKey ? t(sections[v.project.sectionKey]) : t("folders.root"))}
                </p>
              )}
              <Field label={t("files.fileSizeLimit")}>
                <input
                  type="file"
                  name="file"
                  accept={
                    v.project.imagesOnly
                      ? ".png,.jpg,.jpeg,.webp"
                      : ".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx"
                  }
                  required
                />
              </Field>
              <p className="muted">
                {v.project.imagesOnly ? t("files.imageFormats") : t("files.allowedFormats")}
              </p>
              <Button type="submit" disabled={busy}>
                <Upload size={17} />
                {busy ? t("files.uploading") : t("files.upload")}
              </Button>
            </form>
          )}
          {modal === "pdf" && previewFile && (
            <iframe
              className="pdf-reader"
              title={previewFile.title}
              src={download(selected, previewFile, previewFile.content, true)}
            />
          )}
          {modal === "photo" && previewFile && (
            <PhotoViewer
              photos={photos}
              selected={previewFile}
              select={v.navigation.setPreviewFile}
              project={selected}
              title={gallery?.title}
              carousel={!!v.navigation.previewGalleryId}
            />
          )}
          {modal === "new-user" && (
            <CreateUser
              owner={user.roles.includes("Owner")}
              busy={busy}
              onSubmit={(request) => void actions.createUser(request)}
            />
          )}
          {modal === "link" && (
            <>
              <div className="login-note">
                <ShieldCheck size={22} />
                <span> {t("links.singleUseHint")} </span>
              </div>
              <textarea className="link-output" readOnly value={link} rows={4} />
              <Button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(link)
                    .then(() => setNotice(t("links.copied")))
                    .catch(() => setNotice(t("links.copyManually")));
                }}
              >
                <Copy size={17} /> {t("links.copy")}{" "}
              </Button>
            </>
          )}
          {modal === "new-folder" && admin && (
            <form onSubmit={(e) => void actions.folder(formValues(e))}>
              <Field label={t("folders.name")}>
                <input name="name" required maxLength={120} />
              </Field>
              <p className="muted"> {t("folders.createHint")} </p>
              <Button type="submit" disabled={busy}>
                {" "}
                {t("folders.create")}{" "}
              </Button>
            </form>
          )}
          {modal === "stages" && p && admin && (
            <CalendarForm
              define
              milestones={p.milestones}
              busy={busy}
              submit={(list) =>
                void actions.stages(
                  list.map((s) => ({
                    id: s.id || null,
                    name: s.name,
                    description: s.description,
                  })),
                )
              }
            />
          )}
          {["new-update", "edit-update"].includes(modal) && admin && (
            <ActivityForm
              key={v.navigation.editingEntry?.id ?? "new"}
              portal={v}
              save={actions.entry}
            />
          )}
          {modal === "status" && p && admin && (
            <form onSubmit={(e) => void actions.status(formValues(e))}>
              <Field label={t("stages.current")}>
                <select
                  name="stageId"
                  defaultValue={p.stagesCompleted ? "completed" : (p.stageId ?? "")}
                >
                  <option value="">{t("stages.none")}</option>
                  {v.project.orderedStages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  {v.project.orderedStages.length > 0 && (
                    <option value="completed">{t("stages.allCompleted")}</option>
                  )}
                </select>
              </Field>
              <p className="muted"> {t("stages.progressHint")} </p>
              <Button type="submit" disabled={busy}>
                {" "}
                {t("stages.saveStatus")}{" "}
              </Button>
            </form>
          )}
          {modal === "calendar" && p && (
            <CalendarForm
              milestones={p.milestones}
              busy={busy}
              submit={(list) => void actions.calendar(list)}
            />
          )}
          {modal === "account" && (
            <AccountSettings
              user={user}
              busy={busy}
              profile={actions.profile}
              password={actions.password}
            />
          )}
        </Modal>
      )}
    </>
  );
}
