import "./AccountSettings.css";

import { ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";
import type { User } from "../types/portal";
import { Button } from "./Button";
import { Field } from "./Field";
import { LanguageField } from "./LanguageField";

type Props = {
  user: User;
  busy: boolean;
  profile: (values: Record<string, string>) => Promise<void>;
  password: (values: Record<string, string>) => Promise<void>;
};

export function AccountSettings({ user, busy, profile, password }: Props) {
  useTranslation();
  const [active, setActive] = useState("details");
  const tabs = [
    { id: "details", label: t("account.details") },
    { id: "security", label: t("account.security") },
  ];

  return (
    <div className="account-settings">
      <div
        className="account-tabs"
        role="tablist"
        aria-label={t("account.settings")}
        aria-orientation="vertical"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`account-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`account-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
            onKeyDown={(event) => {
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : event.key === "ArrowDown"
                      ? (index + 1) % tabs.length
                      : event.key === "ArrowUp"
                        ? (index + tabs.length - 1) % tabs.length
                        : null;
              if (next === null) {
                return;
              }

              event.preventDefault();
              setActive(tabs[next].id);
              document.getElementById(`account-tab-${tabs[next].id}`)?.focus();
            }}
          >
            {tab.id === "details" ? <UserRound size={18} /> : <ShieldCheck size={18} />}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="account-panels">
        <section
          role="tabpanel"
          id="account-panel-details"
          aria-labelledby="account-tab-details"
          hidden={active !== "details"}
        >
          <h3>{t("account.details")}</h3>
          <form
            className="account-profile-form"
            onSubmit={(e) => {
              e.preventDefault();
              void profile(
                Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>,
              );
            }}
          >
            <Field label={t("common.fullName")}>
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={user.displayName}
                autoComplete="name"
              />
            </Field>
            <Field label={t("common.email")}>
              <input
                name="email"
                type="email"
                required
                defaultValue={user.email ?? ""}
                autoComplete="email"
              />
            </Field>
            <p className="muted">{t("account.emailSignInHint")}</p>
            <Field label={t("common.phone")}>
              <input
                name="phoneNumber"
                type="tel"
                maxLength={40}
                defaultValue={user.phoneNumber ?? ""}
                autoComplete="tel"
              />
            </Field>
            <LanguageField value={user.language} />
            <Field label={t("account.confirmCurrentPassword")}>
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {" "}
              {t("account.saveDetails")}{" "}
            </Button>
          </form>
        </section>
        <section
          role="tabpanel"
          id="account-panel-security"
          aria-labelledby="account-tab-security"
          hidden={active !== "security"}
        >
          <h3>{t("account.security")}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void password(
                Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>,
              );
            }}
          >
            <p className="muted">{t("account.changePasswordHint")}</p>
            {user.hasPassword && (
              <Field label={t("auth.currentPassword")}>
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
            )}
            <Field label={t("auth.newPasswordMinimum")}>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </Field>
            <Field label={t("auth.confirmPassword")}>
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </Field>
            <p className="muted">{t("auth.passwordCharacterHint")}</p>
            <Button type="submit" disabled={busy}>
              {" "}
              {t("account.savePassword")}{" "}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
