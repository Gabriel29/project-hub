import "./MaintenanceDate.css";

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { locale, t } from "../i18n";
import type { PageContext } from "../pages/PageContext";
import { maintenanceApi } from "../services/api/maintenance";
import { Button } from "./Button";
import { Field } from "./Field";
import { Modal } from "./Modal";
import { PageHead } from "./PageHead";

export function MaintenanceDate({ context: v }: { context: PageContext }) {
  useTranslation();
  const current = v.project.data.nextMaintenanceDate ?? "";
  const [date, setDate] = useState(current);
  const [open, setOpen] = useState(false);
  const { isManager } = v.session;

  return (
    <>
      <PageHead
        title={t("navigation.maintenance")}
        className="maintenance-heading"
        action={
          isManager && (
            <Button
              secondary
              onClick={() => {
                setDate(current);
                setOpen(true);
              }}
            >
              {" "}
              {t("maintenance.update")}{" "}
            </Button>
          )
        }
      />
      {current && (
        <div className="maintenance-notice" role="status">
          {" "}
          {t("maintenance.nextLabel")}{" "}
          {new Date(current + "T12:00:00").toLocaleDateString(locale(), {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      )}
      {isManager && open && (
        <Modal title={t("maintenance.update")} onClose={() => setOpen(false)}>
          {v.feedback.error && (
            <div className="alert" role="alert">
              {v.feedback.error}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void v.project.run(
                async () => {
                  await maintenanceApi.setDate(v.projects.selectedId, date || null);
                  setOpen(false);
                },
                t("maintenance.dateSaved"),
                false,
              );
            }}
          >
            <Field label={t("maintenance.nextDateOptional")}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={v.feedback.busy}
              />
            </Field>
            <Button type="submit" disabled={v.feedback.busy || date === current}>
              {" "}
              {t("maintenance.saveDate")}{" "}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
