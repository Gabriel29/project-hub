import { language, t } from "../../i18n";
import { localizeApiCode, localizeApiMessage } from "./errorMessages";

type ApiErrorResponse = {
  message?: string;
  code?: string;
  detail?: string;
  title?: string;
  errors?: Record<string, string[]>;
};

export async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const form = body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      "X-ProjectHub-Request": "1",
      "Accept-Language": language(),
      ...(!form && body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
  });

  if (!res.ok) {
    const fallback = t("errors.operationFailed");
    let message = fallback;

    try {
      const error: ApiErrorResponse = await res.json();
      const validation = error.errors
        ? Object.values(error.errors).flat().map(localizeApiMessage).join(" ") || undefined
        : undefined;
      const detail =
        localizeApiCode(error.code === "invalidRequest" && validation ? undefined : error.code) ??
        validation ??
        error.message ??
        error.detail ??
        (error.title === "Unauthorized" ? undefined : error.title);

      if (detail) {
        message = localizeApiMessage(detail);
      }
    } catch {
      // Non-JSON errors use the status-specific or generic translated fallback.
    }

    if (res.status === 401 && message === fallback) {
      message =
        path === "/auth/setup"
          ? t("errors.setupLink")
          : path === "/auth/login"
            ? t("errors.invalidCredentials")
            : path === "/auth/link"
              ? t("errors.expiredOrRevokedLink")
              : t("errors.sessionExpired");
    }

    throw new Error(message);
  }

  const text = await res.text();

  return (text ? JSON.parse(text) : undefined) as T;
}
