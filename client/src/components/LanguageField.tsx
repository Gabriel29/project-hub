import { useTranslation } from "react-i18next";

import { normalizeLanguage, t } from "../i18n";
import { Field } from "./Field";

export function LanguageField({ value }: { value?: string | null }) {
  useTranslation();

  return (
    <Field label={t("account.preferredLanguage")}>
      <select name="language" defaultValue={normalizeLanguage(value)}>
        <option value="en">English</option>
        <option value="ro">Română</option>
      </select>
    </Field>
  );
}
