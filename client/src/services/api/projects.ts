import type {
  ActivityFeed,
  FolderContents,
  FolderSection,
  Project,
  ProjectOverview,
  RecentDocuments,
} from "../../types/portal";
import { api } from "./http";

export type SearchSuggestion = {
  kind: "client" | "project";
  id: string;
  name: string;
  code: string;
  clientId: string | null;
};

export const projectsApi = {
  search: (query: string) =>
    api<SearchSuggestion[]>(`/projects/search?query=${encodeURIComponent(query)}`),
  list: (clientId: string) =>
    api<Project[]>(`/projects${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ""}`),
  detail: (id: string) => api<ProjectOverview>(`/projects/${id}`),
  sections: (id: string) => api<FolderSection[]>(`/projects/${id}/sections`),
  contents: (id: string, folder: string, query = "") =>
    api<FolderContents>(
      `/projects/${id}/folders/${folder}/${query ? `search?query=${encodeURIComponent(query)}` : "contents"}`,
    ),
  activities: (id: string, preview = false) =>
    api<ActivityFeed>(`/projects/${id}/activities${preview ? "?limit=3" : ""}`),
  recent: (id: string) => api<RecentDocuments>(`/projects/${id}/recent-documents`),
  create: (body: unknown) => api<{ id: string }>("/projects", "POST", body),
  update: (id: string, body: unknown) => api(`/projects/${id}`, "PUT", body),
};
