import type { Note } from "../../types/portal";
import { api } from "./http";

export const notesApi = {
  list: (project: string) => api<Note[]>(`/projects/${project}/notes`),
  save: (project: string, body: unknown, id?: string) =>
    api(`/projects/${project}/notes${id ? `/${id}` : ""}`, id ? "PUT" : "POST", body),
  delete: (project: string, id: string) => api(`/projects/${project}/notes/${id}`, "DELETE"),
};
