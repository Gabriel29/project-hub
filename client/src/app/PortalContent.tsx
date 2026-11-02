import { LoaderCircle } from "lucide-react";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../components/Button";
import { Empty } from "../components/Empty";
import { MaintenanceDate } from "../components/MaintenanceDate";
import { PageHead } from "../components/PageHead";
import { t } from "../i18n";
import { pageLabels } from "../logic/navigation";
import type { Portal } from "../logic/usePortal";
import { CalendarPage } from "../pages/CalendarPage";
import { DashboardPage } from "../pages/DashboardPage";
import { DocumentsPage } from "../pages/DocumentsPage";
import type { Project, User } from "../types/portal";

const TeamPage = lazy(() =>
  import("../pages/TeamPage").then((module) => ({ default: module.TeamPage })),
);
const NotesPage = lazy(() =>
  import("../pages/NotesPage").then((module) => ({ default: module.NotesPage })),
);
const ProjectEditPage = lazy(() =>
  import("../pages/ProjectEditPage").then((module) => ({ default: module.ProjectEditPage })),
);

function PageLoading() {
  return (
    <div className="loading inline" role="status">
      <LoaderCircle className="spin" /> {t("projects.loading")}
    </div>
  );
}

export function PortalContent({ portal }: { portal: Portal }) {
  useTranslation();

  return (
    <Suspense fallback={<PageLoading />}>
      <CurrentPage portal={portal} />
    </Suspense>
  );
}

function CurrentPage({ portal }: { portal: Portal }) {
  const { page } = portal.navigation;
  const { isManager: admin, user } = portal.session;
  const { selectedId: selected } = portal.projects;
  const { data: p, error: detailError } = portal.project;
  if (!user) {
    return null;
  }

  if (page === "users" && admin) {
    return (
      <TeamPage
        user={user}
        people={portal.people.items}
        peopleLoading={portal.people.loading}
        busy={portal.feedback.busy}
        setModal={portal.navigation.setModal}
        generateLink={portal.people.generateLink}
        disableUser={portal.people.disableUser}
        revokeUser={portal.people.revokeUser}
      />
    );
  }

  if (!selected) {
    return (
      <Empty
        title={admin ? t("projects.firstProject") : t("projects.noneAssigned")}
        detail={t("projects.emptyHint")}
      />
    );
  }

  if (!p && detailError) {
    return (
      <div role="alert">
        <Empty title={t("projects.loadFailed")} detail={detailError} />
        <Button
          onClick={() => {
            void portal.project
              .refresh()
              .catch((error: Error) => portal.feedback.setError(error.message));
          }}
        >
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  if (!p) {
    return <PageLoading />;
  }

  return <ProjectPage portal={portal} user={user} project={p} />;
}

function ProjectPage({ portal, user, project }: { portal: Portal; user: User; project: Project }) {
  const { page } = portal.navigation;
  const { isManager: admin } = portal.session;
  const { selectedId: selected } = portal.projects;
  const context = {
    ...portal,
    project: { ...portal.project, data: project },
    session: { ...portal.session, user },
  };

  return (
    <>
      {page !== "dashboard" && page !== "maintenance" && <PageHead title={t(pageLabels[page])} />}
      {(page === "dashboard" || page === "progress") && portal.project.resourceError && (
        <div role="alert">
          {portal.project.resourceError}
          <Button
            onClick={() =>
              void portal.project
                .refresh()
                .catch((error: Error) => portal.feedback.setError(error.message))
            }
          >
            {t("common.retry")}
          </Button>
        </div>
      )}
      {(page === "dashboard" || page === "progress") && portal.project.resourceLoading && (
        <PageLoading />
      )}
      {page === "dashboard" && !portal.project.resourceLoading && !portal.project.resourceError && (
        <DashboardPage {...context} />
      )}
      {((page === "files" && admin) ||
        ["contracts", "warranty", "maintenance", "technical"].includes(page)) && (
        <>
          {page === "maintenance" && <MaintenanceDate key={selected} context={context} />}
          <DocumentsPage {...context} />
        </>
      )}
      {page === "progress" && !portal.project.resourceLoading && !portal.project.resourceError && (
        <>
          <CalendarPage {...context} />
        </>
      )}
      {page === "edit-project" && user.roles.includes("Owner") && (
        <ProjectEditPage key={selected} {...portal} />
      )}
      {page === "notes" && admin && <NotesPage key={selected} {...context} />}
    </>
  );
}
