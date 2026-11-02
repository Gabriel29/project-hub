import { useEffect } from "react";

import { t } from "../i18n";
import { progressApi } from "../services/api/progress";
import { useOperationFeedback } from "./useOperationFeedback";
import { usePeople } from "./usePeople";
import { usePortalNavigation } from "./usePortalNavigation";
import { useProjectDetail } from "./useProjectDetail";
import { useProjectResources } from "./useProjectResources";
import { useProjects } from "./useProjects";
import { useProjectView } from "./useProjectView";
import { useSession } from "./useSession";

// Composition only: feature hooks own state, requests, and feature-specific actions.
export function usePortal() {
  const feedback = useOperationFeedback();
  const session = useSession(feedback);
  const navigation = usePortalNavigation();
  const projects = useProjects(session.user?.id, session.isManager, feedback.setError);
  const projectDetail = useProjectDetail(session.user?.id, projects.selectedId);
  const resources = useProjectResources(
    session.user?.id,
    projects.selectedId,
    projectDetail.detail,
    navigation.page,
    navigation.activeFolder,
    navigation.search,
  );
  const { p: data, ...projectView } = useProjectView(
    resources.detail,
    navigation.page,
    navigation.activeFolder,
    session.isManager,
  );
  const people = usePeople({
    userId: session.user?.id,
    enabled:
      session.isManager &&
      (navigation.page === "users" ||
        navigation.page === "edit-project" ||
        navigation.modal === "new-project"),
    feedback,
    refreshClients: projects.refreshClients,
    showLink: () => navigation.setModal("link"),
    closeDialog: () => navigation.setModal(""),
  });
  const { resetProjectView } = navigation;
  const { setError } = feedback;

  useEffect(() => {
    resetProjectView();
    setError("");
  }, [projects.selectedId, session.user?.id, resetProjectView, setError]);

  async function runProjectAction(
    action: () => Promise<unknown>,
    message = t("common.changesSaved"),
    closeDialog = true,
  ) {
    await feedback.run(action, {
      message,
      onSuccess: async () => {
        if (closeDialog) {
          navigation.setModal("");
        }

        await Promise.all([projects.refresh(), projectDetail.refresh(), resources.refresh()]);
      },
    });
  }

  async function markRead() {
    await runProjectAction(
      () => progressApi.markRead(projects.selectedId),
      t("notifications.markedRead"),
    );
  }

  async function logout() {
    await feedback.run(
      async () => {
        await session.signOut();
        projects.reset();
        projectDetail.reset();
        people.reset();
        navigation.reset();
        feedback.reset();
      },
      { message: "" },
    );
  }

  return {
    session: {
      user: session.user,
      loading: session.loading,
      setup: session.setup,
      entry: session.entry,
      activationDetails: session.activationDetails,
      isManager: session.isManager,
      submitLogin: session.submitLogin,
      refreshUser: session.refreshUser,
      logout,
    },
    projects,
    project: {
      ...projectDetail,
      ...projectView,
      detail: resources.detail,
      data,
      listing: resources.listing,
      resourceError: resources.resourceError,
      resourceLoading: resources.resourceLoading,
      currentFolder: resources.folderId,
      canUpload: projectView.canUpload && !!resources.listing && !resources.resourceLoading,
      refresh: async () => {
        await Promise.all([projectDetail.refresh(), resources.refresh()]);
      },
      run: runProjectAction,
      markRead,
    },
    people,
    navigation: {
      ...navigation,
      openUpload: () => {
        if (projectView.canUpload) {
          navigation.openUpload();
        }
      },
    },
    feedback,
  };
}

export type Portal = ReturnType<typeof usePortal>;
