import "./AccountMenu.css";

import { LogOut, Menu, Settings, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";

export function AccountMenu({
  admin,
  manage,
  settings,
  logout,
}: {
  admin: boolean;
  manage: () => void;
  settings: () => void;
  logout: () => void;
}) {
  useTranslation();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) {
      return;
    }

    function outside(e: PointerEvent) {
      if (!container.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }

    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);

    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function action(callback: () => void) {
    setOpen(false);
    trigger.current?.focus();
    callback();
  }

  return (
    <div className="account-menu" ref={container}>
      <button
        ref={trigger}
        className="icon-button"
        aria-label={t("account.menu")}
        aria-expanded={open}
        aria-controls="account-actions"
        onClick={() => setOpen((current) => !current)}
      >
        <Menu size={21} />
      </button>
      {open && (
        <nav id="account-actions" className="account-actions" aria-label={t("account.actions")}>
          {admin && (
            <button onClick={() => action(manage)}>
              <Users size={18} /> {t("users.manage")}{" "}
            </button>
          )}
          <button onClick={() => action(settings)}>
            <Settings size={18} /> {t("account.settings")}{" "}
          </button>
          <button onClick={() => action(logout)}>
            <LogOut size={18} /> {t("auth.signOut")}{" "}
          </button>
        </nav>
      )}
    </div>
  );
}
