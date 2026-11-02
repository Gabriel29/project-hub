import "./ProjectEditPage.css";

import { useTranslation } from "react-i18next";

import { ProjectForm } from "../components/ProjectForm";
import { t } from "../i18n";
import { useDialogActions } from "../logic/useDialogActions";
import type { Portal } from "../logic/usePortal";

export function ProjectEditPage(v: Portal) {
  useTranslation();
  const { saveProject } = useDialogActions(v);

  return (
    <section className="project-edit-page">
      <p className="muted">
        {t("projects.updateDetails")} {v.project.data?.code}.
      </p>
      <ProjectForm portal={v} editing save={saveProject} />
    </section>
  );
}
