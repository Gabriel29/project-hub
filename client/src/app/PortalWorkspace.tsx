import "./PortalWorkspace.css";

import {
  CalendarDays,
  CheckCircle2,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  Menu,
  NotebookPen,
  Plus,
  Settings2,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

import { AccountMenu } from "../components/AccountMenu";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Logo } from "../components/Logo";
import { ProjectSearch } from "../components/ProjectSearch";
import { t } from "../i18n";
import { pageLabels } from "../logic/navigation";
import type { Portal } from "../logic/usePortal";
import { PortalContent } from "./PortalContent";

const PortalDialogs = lazy(() =>
  import("../components/PortalDialogs").then((module) => ({ default: module.PortalDialogs })),
);
const nav = [
  ["dashboard", LayoutDashboard],
  ["progress", CalendarDays],
  ["contracts", FileText],
  ["warranty", ShieldCheck],
  ["maintenance", Wrench],
  ["technical", ListChecks],
] as const;

export function PortalWorkspace({ portal }: { portal: Portal }) {
  useTranslation();
  const { user, isManager: admin } = portal.session;
  const { error, setError, notice } = portal.feedback;
  const {
    items: projects,
    selectedId: selected,
    selectProject: setSelected,
    clients,
    selectedClientId: selectedClient,
    selectClient: setSelectedClient,
  } = portal.projects;
  const { page, setModal, sidebar, setSidebar, go } = portal.navigation;
  if (!user) {
    return null;
  }

  return (
    <div className="app-shell">
      <aside id="main-navigation" className={`sidebar ${sidebar ? "open" : ""}`}>
        <button
          className="icon-button rail-close"
          aria-label={t("shell.closeMenu")}
          onClick={() => setSidebar(false)}
        >
          <X size={18} />
        </button>
        <Logo />
        <span className="sidebar-label">{t("shell.workspace")}</span>
        <div className="sidebar-selectors">
          {admin && (
            <ProjectSearch
              select={(r) => {
                portal.projects.selectSearchResult(r);
                go("dashboard");
              }}
            />
          )}
          {admin && (
            <Field label={t("roles.client")}>
              <select
                aria-label={t("projects.selectClient")}
                value={selectedClient}
                disabled={!admin}
                onChange={(e) => {
                  setSelectedClient(e.target.value);
                  setModal("");
                }}
              >
                <option value="none">{t("projects.noClient")}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t("projects.project")}>
            <select
              aria-label={t("projects.selectProject")}
              value={selected}
              disabled={!projects.length}
              onChange={(e) => {
                setSelected(e.target.value);
                setModal("");
              }}
            >
              {!projects.length && <option value="">{t("projects.none")}</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              aria-current={page === name ? "page" : undefined}
              className={page === name ? "active" : ""}
              key={name}
              onClick={() => go(name)}
            >
              <Icon size={20} />
              <span>{t(pageLabels[name])}</span>
            </button>
          ))}
          {admin && (
            <>
              <span className="sidebar-label">{t("shell.administration")}</span>
              {(
                [
                  ["files", FolderOpen],
                  ["notes", NotebookPen],
                  ["edit-project", Settings2],
                ] as const
              )
                .filter(([id]) => id !== "edit-project" || user.roles.includes("Owner"))
                .map(([id, Icon]) => (
                  <button
                    key={id}
                    aria-current={page === id ? "page" : undefined}
                    className={page === id ? "active" : ""}
                    onClick={() => go(id)}
                  >
                    <Icon size={20} />
                    <span>{t(pageLabels[id])}</span>
                  </button>
                ))}
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <small>
            © {new Date().getFullYear()} {t("brand.companyName")}
          </small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label={t("shell.menu")}
            aria-expanded={sidebar}
            aria-controls="main-navigation"
            onClick={() => setSidebar((open) => !open)}
          >
            <Menu size={18} aria-hidden="true" />
            <span>{t("shell.menu")}</span>
          </button>
          <div>
            <strong>{t("shell.portalName")}</strong>
            <span>{t("shell.welcomeUser", { name: user.displayName })}</span>
          </div>
          <div className="topbar-right">
            {admin && (
              <Button onClick={() => setModal("new-project")}>
                <Plus size={16} /> {t("projects.create")}{" "}
              </Button>
            )}
            <div className="profile">
              <span className="avatar">
                {user.displayName
                  .split(" ")
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div>
                <strong>{user.displayName}</strong>
                <small>{admin ? t("roles.administrator") : t("roles.client")}</small>
              </div>
            </div>
            <AccountMenu
              admin={admin}
              manage={() => go("users")}
              settings={() => setModal("account")}
              logout={() => void portal.session.logout()}
            />
          </div>
        </header>
        <main className="main-content">
          {error && (
            <div className="alert" role="alert">
              {error}
              <button aria-label={t("common.dismissError")} onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <CheckCircle2 size={19} />
              {notice}
            </div>
          )}
          <PortalContent portal={portal} />
        </main>
      </div>
      {portal.navigation.modal ? (
        <Suspense fallback={null}>
          <PortalDialogs {...portal} />
        </Suspense>
      ) : null}
    </div>
  );
}
