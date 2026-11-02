import { LoaderCircle } from "lucide-react";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";
import { usePortal } from "../logic/usePortal";
import { LoginPage } from "../pages/LoginPage";

const PortalWorkspace = lazy(() =>
  import("./PortalWorkspace").then((module) => ({ default: module.PortalWorkspace })),
);

function LoadingPortal() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> {t("shell.loading")}
    </div>
  );
}

export function App() {
  useTranslation();
  const portal = usePortal();
  if (portal.session.loading) {
    return <LoadingPortal />;
  }

  if (!portal.session.user || portal.session.entry.purpose) {
    return (
      <LoginPage
        key={`${portal.session.entry.purpose}:${portal.session.entry.token}:${portal.session.entry.setupKey}`}
        portal={portal}
      />
    );
  }

  return (
    <Suspense fallback={<LoadingPortal />}>
      <PortalWorkspace portal={portal} />
    </Suspense>
  );
}
