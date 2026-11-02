import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ro from "./locales/ro.json";

export type Language = "en" | "ro";

type CatalogKey = keyof typeof en;
type PluralKey<Key extends string> = Key extends `${infer Base}_${"one" | "few" | "other"}`
  ? Base
  : never;

export type TranslationKey = CatalogKey | PluralKey<CatalogKey>;

export const normalizeLanguage = (value: unknown): Language => (value === "ro" ? "ro" : "en");

// Database preference is authoritative; missing/unsupported values always use English.
void i18next.use(initReactI18next).init({
  resources: { en: { translation: en }, ro: { translation: ro } },
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en", "ro"],
  keySeparator: false,
  nsSeparator: false,
  initAsync: false,
  interpolation: { escapeValue: false },
});

export const t = (key: TranslationKey, values?: Record<string, unknown>): string =>
  i18next.t(key, values);

export const language = (): Language => normalizeLanguage(i18next.resolvedLanguage);

export const locale = () => (language() === "ro" ? "ro-RO" : "en-GB");

export function setLanguage(value: unknown) {
  const next = normalizeLanguage(value);
  document.documentElement.lang = next;
  void i18next.changeLanguage(next);
}

export default i18next;
