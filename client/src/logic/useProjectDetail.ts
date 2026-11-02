import { useCallback, useEffect, useRef, useState } from "react";

import { projectsApi } from "../services/api/projects";
import type { ProjectOverview } from "../types/portal";

// Initial loading, polling, and mutation refreshes share the same response guard.
export function useProjectDetail(userId: string | undefined, projectId: string) {
  const [loaded, setLoaded] = useState<{ userId: string; detail: ProjectOverview } | null>(null);
  const [error, setError] = useState("");
  const currentScope = useRef({ userId, projectId });
  currentScope.current = { userId, projectId };
  const requestVersion = useRef(0);

  const refresh = useCallback(async () => {
    if (
      !userId ||
      !projectId ||
      currentScope.current.userId !== userId ||
      currentScope.current.projectId !== projectId
    ) {
      return;
    }

    const request = ++requestVersion.current;
    const isCurrent = () =>
      request === requestVersion.current &&
      currentScope.current.userId === userId &&
      currentScope.current.projectId === projectId;
    setError("");
    try {
      const value = await projectsApi.detail(projectId);
      if (isCurrent()) {
        setLoaded({ userId, detail: value });
      }
    } catch (error) {
      if (isCurrent()) {
        setLoaded(null);
        setError((error as Error).message);
        throw error;
      }
    }
  }, [userId, projectId]);

  useEffect(() => {
    setLoaded(null);
    setError("");
    void refresh().catch(() => {});
    if (!userId || !projectId) {
      return;
    }

    const timer = setInterval(() => void refresh().catch(() => {}), 30000);

    return () => {
      requestVersion.current++;
      clearInterval(timer);
    };
  }, [refresh, userId, projectId]);

  function reset() {
    requestVersion.current++;
    currentScope.current = { userId: undefined, projectId: "" };
    setLoaded(null);
    setError("");
  }

  // Never expose the previous project's data during the render before effect cleanup.
  const visibleDetail =
    loaded?.userId === userId && loaded?.detail.project.id === projectId ? loaded.detail : null;

  return { detail: visibleDetail, error, refresh, reset };
}
