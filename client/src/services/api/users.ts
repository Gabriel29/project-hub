import type { User } from "../../types/portal";
import { api } from "./http";

export const usersApi = {
  list: () => api<User[]>("/admin/users"),
  create: (body: unknown) => api<{ link?: { url: string } }>("/admin/users", "POST", body),
  generateLink: (user: User) =>
    api<{ url: string }>(
      `/admin/users/${user.id}/${user.hasPassword ? "reset" : "activation"}`,
      "POST",
    ),
  setDisabled: (id: string, disabled: boolean) =>
    api(`/admin/users/${id}/disabled`, "POST", { disabled }),
  revoke: (id: string) => api(`/admin/users/${id}/revoke-links`, "POST"),
};
