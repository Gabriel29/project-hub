import type { Portal } from "../logic/usePortal";
import type { Project, User } from "../types/portal";

// Project pages receive a narrowed context after the shell confirms these records exist.
export type PageContext = Portal & {
  project: Portal["project"] & { data: Project };
  session: Portal["session"] & { user: User };
};
