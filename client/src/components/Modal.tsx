import "./Modal.css";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useEffectEvent, useRef } from "react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";

export function Modal({
  title,
  children,
  onClose,
  hideTitle = false,
}: {
  title: string;
  hideTitle?: boolean;
  children: ReactNode;
  onClose: () => void;
}) {
  useTranslation();
  const ref = useRef<HTMLElement>(null);
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),a[href]',
        ) ?? [],
      ).filter((element) => !element.closest("[hidden]"));
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();

        return;
      }

      if (e.key !== "Tab") {
        return;
      }

      const list = focusable();
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 className={hideTitle ? "visually-hidden" : undefined}>{title}</h2>
          <button className="icon-button" aria-label={t("common.close")} onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
