import type { Milestone } from "../../types/portal";
import { api } from "./http";

export const progressApi = {
  updateMilestones: (id: string, milestones: Milestone[]) =>
    api(`/projects/${id}/milestones`, "PUT", milestones),
  updateStages: (id: string, body: unknown) => api(`/projects/${id}/stages`, "PUT", body),
  saveActivity: (id: string, body: unknown, entryId?: string) =>
    api(`/projects/${id}/updates${entryId ? `/${entryId}` : ""}`, entryId ? "PUT" : "POST", body),
  deleteActivity: (id: string, entryId: string) =>
    api(`/projects/${id}/updates/${entryId}`, "DELETE"),
  updateStatus: (id: string, body: unknown) => api(`/projects/${id}/status`, "PUT", body),
  markRead: (id: string) => api(`/projects/${id}/read`, "POST"),
};
