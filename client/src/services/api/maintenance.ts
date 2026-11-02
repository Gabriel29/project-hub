import { api } from "./http";

export const maintenanceApi = {
  setDate: (project: string, date: string | null) =>
    api(`/projects/${project}/maintenance-date`, "PUT", { date }),
};
