import { useCallback, useEffect, useRef, useState } from "react";

import { t } from "../i18n";

export type OperationOptions = {
  message?: string;
  onSuccess?: () => void | Promise<void>;
};

// Owns operation feedback only. Callers decide which data to refresh or dialogs to close.
export function useOperationFeedback() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const generation = useRef(0);

  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = setTimeout(() => setNotice(""), 5000);

    return () => clearTimeout(timer);
  }, [notice]);

  const reset = useCallback(() => {
    generation.current++;
    setPendingCount(0);
    setError("");
    setNotice("");
  }, []);

  async function run(action: () => Promise<unknown>, options: OperationOptions = {}) {
    const started = generation.current;
    setPendingCount((count) => count + 1);
    setError("");
    try {
      await action();
      if (started !== generation.current) {
        return;
      }

      await options.onSuccess?.();
      if (started === generation.current) {
        setNotice(options.message ?? t("common.changesSaved"));
      }
    } catch (error) {
      if (started === generation.current) {
        setError((error as Error).message);
      }
    } finally {
      if (started === generation.current) {
        setPendingCount((count) => count - 1);
      }
    }
  }

  return { error, setError, notice, setNotice, busy: pendingCount > 0, run, reset };
}

export type OperationFeedback = ReturnType<typeof useOperationFeedback>;
