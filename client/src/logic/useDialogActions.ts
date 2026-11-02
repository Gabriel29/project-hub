import { t } from "../i18n";
import { authApi } from "../services/api/auth";
import { filesApi } from "../services/api/files";
import { progressApi } from "../services/api/progress";
import { projectsApi } from "../services/api/projects";
import type { Milestone } from "../types/portal";
import type { Portal } from "./usePortal";

export function useDialogActions(v: Portal) {
  const saveProject = (values: Record<string, string>) =>
    v.project.run(async () => {
      const body = {
        ...values,
        clientId: values.clientId === "none" ? null : values.clientId,
      };
      if (v.navigation.modal === "new-project") {
        const r = await projectsApi.create(body);
        v.projects.selectSavedProject(values.clientId, r.id);
      } else {
        await projectsApi.update(v.projects.selectedId, body);
        v.projects.selectSavedProject(values.clientId, v.projects.selectedId);
      }
    });
  const upload = (form: FormData) => {
    if (!v.project.canUpload) {
      return Promise.resolve();
    }

    if (v.project.currentFolder) {
      form.set("folderId", v.project.currentFolder);
    }

    if (v.project.sectionKey) {
      form.set("sectionKey", v.project.sectionKey);
    }

    return v.project.run(() => filesApi.upload(v.projects.selectedId, form), t("files.uploaded"));
  };

  const createUser = v.people.create;
  const calendar = (list: Milestone[]) =>
    v.project.run(() => progressApi.updateMilestones(v.projects.selectedId, list));
  const stages = (list: unknown) =>
    v.project.run(() => progressApi.updateStages(v.projects.selectedId, list));
  const folder = (values: Record<string, string>) =>
    v.project.run(() =>
      filesApi.folder(
        v.projects.selectedId,
        values.name,
        v.project.currentFolder,
        v.project.sectionKey,
      ),
    );
  const profile = (values: Record<string, string>) =>
    v.feedback.run(
      async () => {
        await authApi.profile(values);
        await v.session.refreshUser();
      },
      { message: t("account.detailsSaved") },
    );
  const entry = (form: FormData) =>
    v.project.run(async () => {
      const photoIds = form.getAll("photoContentId").map(String).filter(Boolean);
      const photos = form.getAll("photo").filter((p): p is File => p instanceof File && p.size > 0);
      if (photoIds.length + photos.length > 20) {
        throw new Error(t("activity.fileLimit"));
      }

      for (const photo of photos) {
        const upload = new FormData();
        upload.set("title", String(form.get("title")));
        upload.set("file", photo);
        upload.set("sectionKey", "progress");
        const result = await filesApi.upload(v.projects.selectedId, upload);
        photoIds.push(result.contentId);
      }

      await progressApi.saveActivity(
        v.projects.selectedId,
        {
          title: form.get("title"),
          details: form.get("details"),
          photoIds,
          photoContentId: photoIds[0] ?? null,
        },
        v.navigation.editingEntry?.id,
      );
    }, t("activity.published"));
  const password = (values: Record<string, string>) => {
    if (values.password !== values.confirm) {
      v.feedback.setError(t("auth.passwordMismatch"));

      return Promise.resolve();
    }

    return v.feedback.run(
      async () => {
        await authApi.password(values);
        await v.session.refreshUser();
      },
      { message: t("account.passwordSaved"), onSuccess: () => v.navigation.setModal("") },
    );
  };

  const status = (values: Record<string, string>) =>
    v.project.run(() =>
      progressApi.updateStatus(v.projects.selectedId, {
        stageId: values.stageId === "completed" ? null : values.stageId || null,
        stagesCompleted: values.stageId === "completed",
      }),
    );

  return {
    status,
    stages,
    folder,
    profile,
    entry,
    saveProject,
    upload,
    createUser,
    calendar,
    password,
  };
}
