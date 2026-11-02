import "./LoginPage.css";

import { useTranslation } from "react-i18next";

import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { LanguageField } from "../components/LanguageField";
import { LanguageFlags } from "../components/LanguageFlags";
import { Logo } from "../components/Logo";
import { t } from "../i18n";
import { formValues } from "../logic/formValues";
import type { Portal } from "../logic/usePortal";

export function LoginPage({ portal: v }: { portal: Portal }) {
  useTranslation();
  const activation = v.session.entry.purpose === "activation";
  const reset = v.session.entry.purpose === "reset";
  const newPassword = activation || reset || v.session.setup;

  return (
    <div className="login-layout">
      <div className="login-brand">
        <img
          className="login-illustration"
          src="/brand/workspace-placeholder.svg"
          alt=""
          width={1024}
          height={1536}
          fetchPriority="high"
        />
        <div className="login-brand-copy">
          <span className="eyebrow">{t("brand.workspace")}</span>
          <h1>{t("brand.tagline")}</h1>
          <p> {t("brand.description")} </p>
        </div>
        <small>{t("brand.companyLegal")}</small>
      </div>
      <main className="login-main">
        <div className="login-card">
          <div className="login-card-heading">
            <Logo />
            <LanguageFlags />
          </div>
          <h2>
            {activation
              ? t("auth.activateAccount")
              : reset
                ? t("auth.newPassword")
                : v.session.setup
                  ? t("setup.title")
                  : t("auth.welcome")}
          </h2>
          <p>
            {activation
              ? t("auth.activationDescription")
              : reset
                ? t("auth.resetDescription")
                : v.session.setup
                  ? t("setup.description")
                  : t("auth.signInDescription")}
          </p>
          {v.feedback.error && (
            <div className="alert" role="alert">
              {v.feedback.error}
            </div>
          )}
          {v.feedback.notice && <div role="status">{v.feedback.notice}</div>}
          <form
            onSubmit={(e) => {
              const values = formValues(e);
              if (newPassword && values.password !== values.confirm) {
                v.feedback.setError(t("auth.passwordMismatch"));

                return;
              }

              void v.session.submitLogin(values);
            }}
          >
            {v.session.setup && !v.session.entry.purpose && (
              <>
                <Field label={t("setup.privateKey")}>
                  <input
                    name="token"
                    required
                    type="password"
                    defaultValue={v.session.entry.setupKey}
                    autoComplete="off"
                  />
                </Field>
                <Field label={t("common.fullName")}>
                  <input name="name" required maxLength={120} />
                </Field>
              </>
            )}
            {activation && (
              <Field label={t("common.fullName")}>
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={v.session.activationDetails?.name ?? ""}
                  autoComplete="name"
                />
              </Field>
            )}
            {!reset && (
              <Field label={t("common.email")}>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  defaultValue={activation ? (v.session.activationDetails?.email ?? "") : ""}
                />
              </Field>
            )}
            {(v.session.setup || activation) && (
              <Field label={t("common.phone")}>
                <input
                  name="phoneNumber"
                  type="tel"
                  maxLength={40}
                  autoComplete="tel"
                  defaultValue={activation ? (v.session.activationDetails?.phoneNumber ?? "") : ""}
                />
              </Field>
            )}
            {(activation || (v.session.setup && !v.session.entry.purpose)) && (
              <LanguageField value="en" />
            )}
            <Field label={newPassword ? t("auth.newPassword") : t("auth.password")}>
              <input
                name="password"
                type="password"
                required
                minLength={newPassword ? 6 : 1}
                autoComplete={newPassword ? "new-password" : "current-password"}
              />
            </Field>
            {newPassword && (
              <>
                <Field label={t("auth.confirmPassword")}>
                  <input
                    name="confirm"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </Field>
                <p className="muted"> {t("auth.passwordRequirements")} </p>
              </>
            )}
            <Button type="submit" disabled={v.feedback.busy}>
              {v.feedback.busy
                ? t("auth.checking")
                : newPassword
                  ? t("auth.saveAndContinue")
                  : t("auth.signIn")}
            </Button>
          </form>
          <p className="login-note"> {t("auth.recoveryHint")} </p>
        </div>
        <footer>{t("brand.companyName")}</footer>
      </main>
    </div>
  );
}
