import "./Logo.css";

import { useTranslation } from "react-i18next";

import { t } from "../i18n";

export function Logo() {
  useTranslation();

  return (
    <div className="logo">
      <img
        src="/brand/projecthub-logo.svg"
        width={440}
        height={100}
        decoding="async"
        alt={t("brand.logoAlt")}
      />
    </div>
  );
}
