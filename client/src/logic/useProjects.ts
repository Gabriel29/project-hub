import { useCallback, useEffect, useRef, useState } from "react";

import { type ClientDirectoryEntry, clientsApi } from "../services/api/clients";
import { projectsApi, type SearchSuggestion } from "../services/api/projects";
import type { Project } from "../types/portal";

type ClientOption = ClientDirectoryEntry;

export function useProjects(
  userId: string | undefined,
  isManager: boolean,
  reportError: (message: string) => void,
) {
  const [items, setItems] = useState<Project[]>([]);
  const [directory, setDirectory] = useState<{ userId: string; items: ClientOption[] } | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("none");
  const currentScope = useRef({ userId, selectedClientId, isManager });
  currentScope.current = { userId, selectedClientId, isManager };
  const projectRequest = useRef(0);
  const clientRequest = useRef(0);

  const refresh = useCallback(async () => {
    if (
      !userId ||
      currentScope.current.userId !== userId ||
      currentScope.current.isManager !== isManager ||
      currentScope.current.selectedClientId !== selectedClientId
    ) {
      return;
    }

    const request = ++projectRequest.current;
    const isCurrent = () =>
      request === projectRequest.current &&
      currentScope.current.userId === userId &&
      currentScope.current.isManager === isManager &&
      currentScope.current.selectedClientId === selectedClientId;
    try {
      const list = await projectsApi.list(isManager ? selectedClientId : "");
      if (!isCurrent()) {
        return;
      }

      setItems(list);
      setSelectedId((id) => (list.some((project) => project.id === id) ? id : (list[0]?.id ?? "")));
    } catch (error) {
      if (isCurrent()) {
        throw error;
      }
    }
  }, [userId, isManager, selectedClientId]);

  const refreshClients = useCallback(async () => {
    if (
      !userId ||
      !isManager ||
      !currentScope.current.isManager ||
      currentScope.current.userId !== userId
    ) {
      return;
    }

    const request = ++clientRequest.current;
    const isCurrent = () =>
      request === clientRequest.current &&
      currentScope.current.userId === userId &&
      currentScope.current.isManager;
    try {
      const list = await clientsApi.list();
      if (isCurrent()) {
        setDirectory({ userId, items: list });
      }
    } catch (error) {
      if (isCurrent()) {
        throw error;
      }
    }
  }, [userId, isManager]);

  useEffect(() => {
    void refresh().catch((error) => {
      if (
        currentScope.current.userId === userId &&
        currentScope.current.selectedClientId === selectedClientId
      ) {
        reportError(error.message);
      }
    });

    return () => {
      projectRequest.current++;
    };
  }, [refresh, reportError, userId, selectedClientId]);

  useEffect(() => {
    if (!isManager) {
      clientRequest.current++;
      setDirectory(null);

      return;
    }

    void refreshClients().catch((error) => {
      if (currentScope.current.userId === userId) {
        reportError(error.message);
      }
    });

    return () => {
      clientRequest.current++;
    };
  }, [refreshClients, reportError, userId, isManager]);

  function selectProject(id: string) {
    setSelectedId(id);
  }

  function selectClient(id: string) {
    currentScope.current = { userId, selectedClientId: id, isManager };
    projectRequest.current++;
    setSelectedClientId(id);
    setSelectedId("");
    setItems([]);
  }

  function selectSearchResult(result: SearchSuggestion) {
    const clientId = result.kind === "client" ? result.id : (result.clientId ?? "none");
    const sameClient = selectedClientId === clientId;
    if (!sameClient) {
      selectClient(clientId);
    }

    setSelectedId(result.kind === "project" ? result.id : sameClient ? (items[0]?.id ?? "") : "");
  }

  function selectSavedProject(clientId: string, projectId: string) {
    if (clientId !== selectedClientId) {
      selectClient(clientId);
    }

    setSelectedId(projectId);
  }

  function reset() {
    projectRequest.current++;
    clientRequest.current++;
    currentScope.current = { userId: undefined, selectedClientId: "none", isManager: false };
    setItems([]);
    setDirectory(null);
    setSelectedId("");
    setSelectedClientId("none");
  }

  return {
    items,
    clients: isManager && directory && directory.userId === userId ? directory.items : [],
    selectedId,
    selectedClientId,
    selectProject,
    selectClient,
    selectSearchResult,
    selectSavedProject,
    refresh,
    refreshClients,
    reset,
  };
}
