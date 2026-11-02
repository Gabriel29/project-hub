export type User = {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string;
  language?: string | null;
  clientName?: string | null;
  roles: string[];
  hasPassword: boolean;
  activeLinkExpiresAt?: string | null;
  clientId?: string | null;
  disabled?: boolean;
};

export type Project = {
  id: string;
  clientId: string | null;
  code: string;
  name: string;
  location: string;
  stageId: string | null;
  updatedAt: string;
  description: string;
  manager: string;
  managerPhone: string;
  managerEmail?: string | null;
  clientContactName?: string | null;
  clientContactEmail?: string | null;
  clientContactPhone?: string | null;
  managerUserId: string | null;
  nextMaintenanceDate?: string | null;
  stagesCompleted?: boolean;
  milestones: Milestone[];
};

export type Milestone = {
  stageComplete?: boolean;
  id: string;
  name: string;
  orderIndex: number;
  description: string;
};

export type FileContent = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  sha256: string;
};

export type ProjectFile = {
  id: string;
  title: string;
  folderId: string | null;
  content: FileContent;
  calendarPhoto?: boolean;
};

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  sectionKey: import("../logic/navigation").SectionKey | null;
  clientVisible: boolean;
  clientCanUpload: boolean;
  canUpload: boolean;
  imagesOnly: boolean;
};

export type Event = {
  id: string;
  title: string;
  details: string;
  createdAt: string;
  read: boolean;
};

export type CalendarEntry = {
  id: string;
  title: string;
  details: string;
  occurredAt: string;
  photoContentId: string | null;
  photoIds: string[];
};

export type Detail = {
  rootFolderId?: string | null;
  project: Project;
  files: ProjectFile[];
  events: Event[];
  folders: Folder[];
  sections: FolderSection[];
  updates: CalendarEntry[];
};

export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type FolderSection = {
  folderId: string;
  key: import("../logic/navigation").SectionKey;
  name: string;
  clientVisible: boolean;
  clientCanUpload: boolean;
  canUpload: boolean;
  imagesOnly: boolean;
};

export type ProjectOverview = { project: Project; rootFolderId?: string | null };

export type FolderContents = {
  folder: Folder;
  breadcrumbs: Folder[];
  folders: Folder[];
  files: ProjectFile[];
  paths: Folder[];
};

export type ActivityFeed = { updates: CalendarEntry[]; files: ProjectFile[] };

export type RecentDocuments = { files: ProjectFile[]; folders: Folder[] };
