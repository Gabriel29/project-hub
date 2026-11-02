import "./ProjectForm.css";

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";
import { formValues } from "../logic/formValues";
import type { Portal } from "../logic/usePortal";
import { Button } from "./Button";
import { Field } from "./Field";

export function ProjectForm({
  portal,
  editing,
  save,
}: {
  portal: Portal;
  editing: boolean;
  save: (values: Record<string, string>) => Promise<void>;
}) {
  useTranslation();

  const { data: p } = portal.project;
  const { clients } = portal.projects;
  const { items: people } = portal.people;
  const { busy } = portal.feedback;
  const [managerUserId, setManagerUserId] = useState(editing ? (p?.managerUserId ?? "") : "");

  return (
    <form className="project-form" onSubmit={(e) => void save(formValues(e))}>
      <Field label={t("roles.client")}>
        <select name="clientId" required defaultValue={editing ? (p?.clientId ?? "none") : ""}>
          <option value="" disabled>
            {" "}
            {t("projects.selectClient")}{" "}
          </option>
          <option value="none">{t("projects.noClient")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label={t("common.name")}>
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={editing ? p?.name : ""}
            placeholder={"Vila Lakeview Residence"}
          />
        </Field>
        <Field label={t("projects.location")}>
          <input name="location" maxLength={300} defaultValue={editing ? p?.location : ""} />
        </Field>
        <Field label={t("projects.manager")}>
          <select
            name="managerUserId"
            required
            value={managerUserId}
            onChange={(event) => setManagerUserId(event.target.value)}
          >
            <option value="">{t("projects.selectManager")}</option>
            {people
              .filter((u) => !u.disabled && u.roles.some((r) => r === "Owner" || r === "Admin"))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <Field label={t("projects.description")}>
        <textarea
          name="description"
          rows={3}
          maxLength={6000}
          defaultValue={editing ? p?.description : ""}
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {" "}
        {t("projects.save")}{" "}
      </Button>
    </form>
  );
}
