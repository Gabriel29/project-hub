import "./DashboardPage.css";

import { ArrowRight, Check, Mail, MapPin, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ActivityPost } from "../components/ActivityPost";
import { RecentDocuments } from "../components/RecentDocuments";
import { locale, t } from "../i18n";
import type { PageContext } from "./PageContext";

export function DashboardPage(v: PageContext) {
  useTranslation();
  const { data: p, updates } = v.project;
  const { go, setModal } = v.navigation;
  const owner = v.session.user.roles.includes("Owner");
  const contactName = owner ? p.clientContactName : p.manager;
  const contactEmail = owner ? p.clientContactEmail : p.managerEmail;
  const contactPhone = owner ? p.clientContactPhone : p.managerPhone;
  const { stageIndex: currentIndex } = v.project;
  const { orderedStages } = v.project;
  const { isManager: admin } = v.session;

  return (
    <>
      <section className="overview-heading">
        <div>
          <span className="eyebrow">
            {t("projects.numberPrefix")}
            {p.code}
          </span>
          <h1>{p.name}</h1>
          <p>
            <MapPin size={15} />
            {p.location || t("projects.locationNotSet")}
          </p>
        </div>
      </section>
      <div className="overview-summary has-maintenance">
        <section className="summary-box project-description">
          <span className="eyebrow">{t("projects.descriptionHeading")}</span>
          <p className="pre-text">{p.description || t("projects.emptyDescription")}</p>
        </section>
        <section className="summary-box maintenance-summary">
          <span className="eyebrow">{t("maintenance.nextHeading")}</span>
          <strong>
            {p.nextMaintenanceDate
              ? new Date(p.nextMaintenanceDate + "T12:00:00").toLocaleDateString(locale(), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : t("maintenance.dateNotSet")}
          </strong>
        </section>
        <section className="summary-box manager-contact">
          <span className="eyebrow">
            {owner ? t("projects.clientContactHeading") : t("projects.managerHeading")}
          </span>
          <strong>
            {contactName || (owner ? t("projects.noClient") : t("common.unassigned"))}
          </strong>
          {contactEmail && (
            <a href={`mailto:${contactEmail}`}>
              <Mail size={14} />
              <span>{contactEmail}</span>
            </a>
          )}
          {contactPhone && (
            <a href={`tel:${contactPhone.replace(/[^+\d]/g, "")}`}>
              <Phone size={14} />
              {contactPhone}
            </a>
          )}
        </section>
      </div>
      {(admin || orderedStages.length > 0) && (
        <section className="flat-section">
          <div className="card-heading">
            <h3>{t("stages.title")}</h3>
            {admin && (
              <div className="row-buttons">
                <button className="text-button" onClick={() => setModal("stages")}>
                  {" "}
                  {t("stages.define")}{" "}
                </button>
                <button className="text-button" onClick={() => setModal("status")}>
                  {" "}
                  {t("stages.updateStatus")}{" "}
                </button>
              </div>
            )}
          </div>
          {!orderedStages.length && <p className="muted"> {t("stages.emptyHint")} </p>}

          <div className="horizontal-stages" role="list" aria-label={t("stages.title")}>
            {orderedStages.map((m, i) => (
              <div
                role="listitem"
                aria-current={p.stageId === m.id ? "step" : undefined}
                key={m.id}
                className={p.stageId === m.id ? "selected" : ""}
              >
                <span
                  className={`stage-number ${(m.stageComplete ?? i < currentIndex) ? "complete" : ""}`}
                >
                  {(m.stageComplete ?? i < currentIndex) ? <Check size={17} /> : i + 1}
                </span>
                <strong>{m.name}</strong>
                <small>
                  {(m.stageComplete ?? i < currentIndex)
                    ? t("stages.completed")
                    : m.id === p.stageId
                      ? t("stages.inProgress")
                      : t("stages.planned")}
                </small>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="overview-columns has-photo">
        <div>
          <section className="progress-updates">
            <div className="card-heading">
              <h3>{t("activity.updates")}</h3>
              <button className="text-button" onClick={() => go("progress")}>
                {" "}
                {t("common.viewAll")} <ArrowRight size={14} />
              </button>
            </div>
            {updates.length ? (
              <div className="news-feed">
                {updates.slice(0, 3).map((e) => (
                  <ActivityPost key={e.id} entry={e} context={v} compact />
                ))}
              </div>
            ) : (
              <p className="muted"> {t("activity.emptyUpdates")} </p>
            )}
          </section>
        </div>
        <RecentDocuments context={v} />
      </div>
    </>
  );
}
