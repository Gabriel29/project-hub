import { api } from "./http";

export type ClientDirectoryEntry = {
  id: string;
  displayName: string;
  email: string | null;
  code?: string | null;
};

export type ClientProfile = {
  id: string;
  displayName: string;
  email: string | null;
  phoneNumber: string | null;
};

export const clientsApi = {
  list: () => api<ClientDirectoryEntry[]>("/clients"),
  me: () => api<ClientProfile>("/clients/me"),
};
