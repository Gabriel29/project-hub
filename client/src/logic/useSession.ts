import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

import { setLanguage, t } from "../i18n";
import { authApi } from "../services/api/auth";
import type { User } from "../types/portal";
import type { OperationFeedback } from "./useOperationFeedback";

function readEntry() {
  const params = new URLSearchParams(location.hash.slice(1));

  return {
    setupKey: params.get("setup") ?? "",
    token: params.get("activation") ?? params.get("reset") ?? "",
    purpose: params.has("activation") ? "activation" : params.has("reset") ? "reset" : "",
  };
}

export function useSession(feedback: OperationFeedback) {
  const [entry, setEntry] = useState(readEntry);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(false);
  const [activationDetails, setActivationDetails] = useState<Awaited<
    ReturnType<typeof authApi.activation>
  > | null>(null);
  const generation = useRef(0);
  const { setError } = feedback;
  const userId = user?.id;
  const userLanguage = user?.language;
  const isManager = user?.roles.some((role) => role === "Owner" || role === "Admin") ?? false;

  const handleEntryNavigation = useEffectEvent(() => {
    const next = readEntry();
    if (!next.purpose && !next.setupKey) {
      return;
    }

    history.replaceState(null, "", location.pathname + location.search);
    if (
      next.purpose === entry.purpose &&
      next.token === entry.token &&
      next.setupKey === entry.setupKey
    ) {
      return;
    }

    // Fragment navigation does not remount the SPA. Supersede pending session requests.
    generation.current++;
    setEntry(next);
    setActivationDetails(null);
    setError("");
    setLanguage("en");
  });

  useEffect(() => {
    // Read the fragment in a pure initializer; clear it only after mount for Strict Mode.
    if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }

    setLanguage("en");
    const handleNavigation = () => handleEntryNavigation();
    window.addEventListener("hashchange", handleNavigation);
    window.addEventListener("popstate", handleNavigation);

    return () => {
      window.removeEventListener("hashchange", handleNavigation);
      window.removeEventListener("popstate", handleNavigation);
    };
  }, [setError]);

  useEffect(() => {
    if (userId && !entry.purpose) {
      setLanguage(userLanguage);
    }
  }, [userId, userLanguage, entry.purpose]);

  const initialize = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const [status, account, activation] = await Promise.all([
        authApi.status(),
        authApi.me().catch(() => null),
        entry.purpose === "activation" ? authApi.activation(entry.token) : null,
      ]);
      if (request !== generation.current) {
        return;
      }

      setSetup(status.required);
      setActivationDetails(activation);
      setUser(account);
      if (account && !entry.purpose) {
        setLanguage(account.language);
      }
    } catch (error) {
      if (request === generation.current) {
        setError((error as Error).message);
      }
    } finally {
      if (request === generation.current) {
        setLoading(false);
      }
    }
  }, [entry.purpose, entry.token, setError]);

  useEffect(() => {
    void initialize();

    return () => {
      generation.current++;
    };
  }, [initialize]);

  async function refreshUser() {
    const request = generation.current;
    const account = await authApi.me();
    if (request === generation.current) {
      setUser(account);
    }
  }

  async function submitLogin(values: Record<string, string>) {
    await feedback.run(
      async () => {
        const request = generation.current;
        const { purpose, token } = entry;
        if (purpose) {
          await authApi.submit(purpose === "activation" ? "/auth/activate" : "/auth/reset", {
            token,
            password: values.password,
            ...(purpose === "activation"
              ? {
                  name: values.name,
                  email: values.email,
                  phoneNumber: values.phoneNumber,
                  language: values.language,
                }
              : {}),
          });
          if (request !== generation.current) {
            return;
          }

          if (purpose === "reset") {
            setUser(null);
          }

          setEntry((current) => ({ ...current, purpose: "", token: "" }));
        } else {
          await authApi.submit(
            setup ? "/auth/setup" : "/auth/login",
            setup
              ? {
                  token: values.token,
                  name: values.name,
                  phoneNumber: values.phoneNumber,
                  email: values.email,
                  password: values.password,
                  language: values.language,
                }
              : { email: values.email, password: values.password },
          );
          await initialize();
        }
      },
      { message: t("common.detailsSaved") },
    );
  }

  // Cross-feature cleanup belongs to usePortal; this hook clears only session state.
  async function signOut() {
    await authApi.logout();
    generation.current++;
    setUser(null);
    setActivationDetails(null);
    setLanguage("en");
  }

  return {
    user,
    loading,
    setup,
    entry,
    activationDetails,
    isManager,
    refreshUser,
    submitLogin,
    signOut,
  };
}
