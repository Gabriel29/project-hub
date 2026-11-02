import { api } from "./http";

export const filesApi = {
  renameFolder: (project: string, folder: string, name: string) =>
    api(`/projects/${project}/files/folders/${folder}/name`, "PUT", { name }),
  rename: (project: string, file: string, title: string) =>
    api(`/projects/${project}/files/${file}/name`, "PUT", { title }),
  moveFolder: (project: string, folder: string, folderId: string | null) =>
    api(`/projects/${project}/files/folders/${folder}/parent`, "PUT", {
      folderId,
    }),
  deleteFolder: (project: string, folder: string) =>
    api(`/projects/${project}/files/folders/${folder}`, "DELETE"),
  delete: (project: string, file: string) => api(`/projects/${project}/files/${file}`, "DELETE"),
  upload: (project: string, form: FormData) =>
    api<{ id: string; contentId: string }>(`/projects/${project}/files`, "POST", form),
  folder: (project: string, name: string, parentId: string | null, sectionKey?: string | null) =>
    api(`/projects/${project}/files/folders`, "POST", {
      name,
      parentId,
      sectionKey,
    }),
  move: (project: string, file: string, folderId: string | null) =>
    api(`/projects/${project}/files/${file}/folder`, "PUT", { folderId }),
};
