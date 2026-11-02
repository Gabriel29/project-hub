import { useCallback, useEffect, useRef, useState } from "react";

import { t } from "../i18n";
import { usersApi } from "../services/api/users";
import type { User } from "../types/portal";
import type { OperationFeedback } from "./useOperationFeedback";

type PeopleOptions = {
  userId: string | undefined;
  enabled: boolean;
  feedback: OperationFeedback;
  refreshClients: () => Promise<void>;
  showLink: () => void;
  closeDialog: () => void;
};

export function usePeople({
  userId,
  enabled,
  feedback,
  refreshClients,
  showLink,
  closeDialog,
}: PeopleOptions) {
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessLink, setAccessLink] = useState("");
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const requestVersion = useRef(0);
  const { setError } = feedback;

  const refresh = useCallback(async () => {
    if (!userId || currentUser.current !== userId) {
      return;
    }

    const request = ++requestVersion.current;
    setLoading(true);
    try {
      const list = await usersApi.list();
      if (request === requestVersion.current && currentUser.current === userId) {
        setItems(list);
      }
    } catch (error) {
      if (request === requestVersion.current && currentUser.current === userId) {
        throw error;
      }
    } finally {
      if (request === requestVersion.current && currentUser.current === userId) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void refresh().catch((error) => {
      if (currentUser.current === userId) {
        setError(error.message);
      }
    });

    const refreshOnFocus = () => {
      void refresh().catch((error: Error) => setError(error.message));
    };

    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      requestVersion.current++;
    };
  }, [enabled, refresh, userId, setError]);

  async function create(request: unknown) {
    await feedback.run(
      async () => {
        const owner = userId;
        const result = await usersApi.create(request);
        if (currentUser.current !== owner) {
          return;
        }

        setAccessLink(result.link?.url ?? "");
        if (result.link) {
          showLink();
        } else {
          closeDialog();
        }

        await Promise.all([refresh(), refreshClients()]);
      },
      { message: t("users.created") },
    );
  }

  async function generateLink(person: User) {
    setAccessLink("");
    await feedback.run(
      async () => {
        const owner = userId;
        const result = await usersApi.generateLink(person);
        if (currentUser.current !== owner) {
          return;
        }

        setAccessLink(result.url);
        showLink();
        await refresh();
      },
      { message: person.hasPassword ? t("links.resetValidity") : t("links.activationValidity") },
    );
  }

  async function disableUser(person: User) {
    await feedback.run(async () => {
      const owner = userId;
      await usersApi.setDisabled(person.id, !person.disabled);
      if (currentUser.current !== owner) {
        return;
      }

      await Promise.all([refresh(), refreshClients()]);
    });
  }

  async function revokeUser(person: User) {
    await feedback.run(async () => {
      await usersApi.revoke(person.id);
      setAccessLink("");
      await refresh();
    });
  }

  function reset() {
    requestVersion.current++;
    currentUser.current = undefined;
    setItems([]);
    setLoading(true);
    setAccessLink("");
  }

  return {
    items,
    loading,
    accessLink,
    refresh,
    create,
    generateLink,
    disableUser,
    revokeUser,
    reset,
  };
}
