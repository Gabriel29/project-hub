import "./CalendarPage.css";

import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ActivityPost } from "../components/ActivityPost";
import { Button } from "../components/Button";
import { t } from "../i18n";
import type { PageContext } from "./PageContext";

export function CalendarPage(v: PageContext) {
  useTranslation();
  const { updates } = v.project;
  const { isManager: admin } = v.session;
  const { setModal } = v.navigation;
  const activities = updates;

  return (
    <>
      <section
        className="stage-activities"
        role="region"
        aria-label={t("activity.projectActivities")}
      >
        {admin && (
          <div className="activity-actions">
            <Button
              onClick={() => {
                v.navigation.setEditingEntry(null);
                setModal("new-update");
              }}
            >
              <Plus size={16} /> {t("activity.add")}{" "}
            </Button>
          </div>
        )}
        {!activities.length && <p className="muted">{t("activity.empty")}</p>}
        <div className="activity-grid">
          {activities.map((e) => (
            <ActivityPost key={e.id} entry={e} context={v} />
          ))}
        </div>
      </section>
    </>
  );
}
