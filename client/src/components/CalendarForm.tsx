import "./CalendarForm.css";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";
import type { Milestone } from "../types/portal";
import { Button } from "./Button";
import { Field } from "./Field";

export function CalendarForm({
  milestones,
  busy,
  submit,
  define = false,
}: {
  milestones: Milestone[];
  busy: boolean;
  submit: (m: Milestone[]) => void;
  define?: boolean;
}) {
  useTranslation();
  const [list, setList] = useState([...milestones].sort((a, b) => a.orderIndex - b.orderIndex));

  function update(i: number, key: "name" | "description", value: string) {
    setList(list.map((m, n) => (n === i ? { ...m, [key]: value } : m)));
  }

  function move(i: number, delta: number) {
    const next = [...list];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    setList(next);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(list.map((s, i) => ({ ...s, orderIndex: i })));
      }}
    >
      <p className="muted">
        {define ? t("stages.defineNamesAndOrder") : t("stages.updateDescriptions")}
      </p>
      <div className="stage-editor">
        {list.map((m, i) => (
          <div key={m.id || `new-${i}`} className="stage-editor-row">
            {define ? (
              <Field label={t("stages.numbered", { index: i + 1 })}>
                <input
                  aria-label={t("stages.nameNumbered", { index: i + 1 })}
                  required
                  maxLength={120}
                  value={m.name}
                  onChange={(e) => update(i, "name", e.target.value)}
                />
              </Field>
            ) : (
              <strong>{m.name}</strong>
            )}
            {define && (
              <div className="row-buttons">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("stages.moveUp", { index: i + 1 })}
                  disabled={!i}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={17} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("stages.moveDown", { index: i + 1 })}
                  disabled={i === list.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={17} />
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setList(list.filter((_, n) => n !== i))}
                >
                  <Trash2 size={15} /> {t("common.remove")}{" "}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {define && list.length > 0 && (
        <p className="stage-completion-note">
          {t("stages.allCompleted")} · {t("stages.completionHint")}
        </p>
      )}
      {define && (
        <Button
          type="button"
          secondary
          onClick={() =>
            setList([
              ...list,
              {
                id: "",
                name: "",
                orderIndex: list.length,
                description: "",
              },
            ])
          }
        >
          <Plus size={16} /> {t("stages.add")}{" "}
        </Button>
      )}
      <div className="form-submit">
        <Button type="submit" disabled={busy}>
          {" "}
          {define ? t("stages.saveStages") : t("stages.saveCalendar")}
        </Button>
      </div>
    </form>
  );
}
