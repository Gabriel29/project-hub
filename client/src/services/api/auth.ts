import type { User } from "../../types/portal";
import { api } from "./http";

export type AuthSubmitPath = "/auth/activate" | "/auth/reset" | "/auth/setup" | "/auth/login";

export const authApi = {
  status: () => api<{ required: boolean }>("/auth/setup-status"),
  me: () => api<User>("/auth/me"),
  logout: () => api("/auth/logout", "POST"),
  submit: (path: AuthSubmitPath, body: unknown) => api(path, "POST", body),
  profile: (body: unknown) => api("/auth/profile", "PUT", body),
  activation: (token: string) =>
    api<{ name: string; email: string; phoneNumber: string | null; language?: string | null }>(
      "/auth/activation-details",
      "POST",
      { token },
    ),
  password: (body: unknown) => api("/auth/password", "POST", body),
};
