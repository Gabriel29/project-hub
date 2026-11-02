import "./LanguageFlags.css";

import { useTranslation } from "react-i18next";

import { language, setLanguage } from "../i18n";

// Access-page presentation only. These buttons never submit or save a preference.
export function LanguageFlags() {
  useTranslation();

  return (
    <div className="language-flags" role="group" aria-label="English / Română">
      {(
        [
          ["en", "🇬🇧", "English"],
          ["ro", "🇷🇴", "Română"],
        ] as const
      ).map(([code, flag, label]) => (
        <button
          key={code}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={language() === code}
          onClick={() => setLanguage(code)}
        >
          <span aria-hidden="true">{flag}</span>
        </button>
      ))}
    </div>
  );
}
