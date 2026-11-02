import "./CreateUser.css";

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";
import { Button } from "./Button";
import { Field } from "./Field";

export function CreateUser({
  owner,
  busy,
  onSubmit,
}: {
  owner: boolean;
  busy: boolean;
  onSubmit: (v: unknown) => void;
}) {
  useTranslation();
  const [isAdmin, setAdmin] = useState(false);

  return (
    <form
      className="create-user-form"
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget));
        onSubmit({ ...v, admin: isAdmin });
      }}
    >
      {owner && (
        <Field label={t("users.role")}>
          <select
            value={isAdmin ? "admin" : "client"}
            onChange={(e) => setAdmin(e.target.value === "admin")}
          >
            <option value="client">{t("roles.client")}</option>
            <option value="admin">{t("roles.administrator")}</option>
          </select>
        </Field>
      )}
      <Field label={t("common.fullName")}>
        <input name="name" required maxLength={120} />
      </Field>
      <Field label={t("common.phone")}>
        <input name="phoneNumber" type="tel" maxLength={40} />
      </Field>
      <Field label={t("common.email")}>
        <input name="email" type="email" required />
      </Field>
      <div
        className={isAdmin ? "create-user-client-field is-reserved" : "create-user-client-field"}
        aria-hidden={isAdmin}
      >
        <Field label={t("users.clientIdentificationName")}>
          <input name="clientName" required={!isAdmin} disabled={isAdmin} maxLength={120} />
        </Field>
      </div>
      <p className="login-note">{t("users.invitationHint")}</p>
      <Button type="submit" disabled={busy}>
        {" "}
        {t("users.create")}{" "}
      </Button>
    </form>
  );
}
