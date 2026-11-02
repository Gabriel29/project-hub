-- PostgreSQL projecthub baseline, executed by .NET through Npgsql.
CREATE SCHEMA IF NOT EXISTS projecthub;

-- Referenced tables precede dependent tables so foreign keys can be declared here.

CREATE TABLE projecthub."Clients" (
    "Id" uuid NOT NULL CONSTRAINT "PK_Clients" PRIMARY KEY,
    "CodePrefix" text,
    "Name" text NOT NULL,
    "UserId" text NOT NULL,
    CONSTRAINT "FK_Clients_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES identity."AspNetUsers"("Id") ON DELETE RESTRICT
);

CREATE TABLE projecthub."Projects" (
    "Id" uuid NOT NULL CONSTRAINT "PK_Projects" PRIMARY KEY,
    "ManagerUserId" text,
    "NextMaintenanceDate" date,
    "Code" text NOT NULL,
    "Name" text NOT NULL,
    "Location" text NOT NULL,
    "Description" text NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    "ClientId" uuid,
    CONSTRAINT "FK_Projects_AspNetUsers_ManagerUserId" FOREIGN KEY ("ManagerUserId") REFERENCES identity."AspNetUsers"("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Projects_Clients_ClientId" FOREIGN KEY ("ClientId") REFERENCES projecthub."Clients"("Id") ON DELETE RESTRICT
);

CREATE TABLE projecthub."Folders" (
    "Id" uuid NOT NULL CONSTRAINT "PK_Folders" PRIMARY KEY,
    "ProjectId" uuid NOT NULL,
    "ParentId" uuid,
    "SectionKey" character varying(32),
    "Name" character varying(120) NOT NULL,
    "CreatedBy" text NOT NULL,
    CONSTRAINT "AK_Folders_ProjectId_Id" UNIQUE ("ProjectId", "Id"),
    CONSTRAINT "FK_Folders_AspNetUsers_CreatedBy" FOREIGN KEY ("CreatedBy") REFERENCES identity."AspNetUsers"("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Folders_Folders_ProjectId_ParentId" FOREIGN KEY ("ProjectId", "ParentId") REFERENCES projecthub."Folders"("ProjectId", "Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Folders_Projects_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES projecthub."Projects"("Id") ON DELETE CASCADE
);

CREATE TABLE projecthub."Files" (
    "Id" uuid NOT NULL CONSTRAINT "PK_Files" PRIMARY KEY,
    "ProjectId" uuid NOT NULL,
    "Title" text NOT NULL,
    "FolderId" uuid NOT NULL,
    CONSTRAINT "AK_Files_ProjectId_Id" UNIQUE ("ProjectId", "Id"),
    CONSTRAINT "FK_Files_Folders_ProjectId_FolderId" FOREIGN KEY ("ProjectId", "FolderId") REFERENCES projecthub."Folders"("ProjectId", "Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Files_Projects_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES projecthub."Projects"("Id") ON DELETE CASCADE
);

CREATE TABLE projecthub."FileContents" (
    "Id" uuid NOT NULL CONSTRAINT "PK_FileContents" PRIMARY KEY,
    "ProjectFileId" uuid NOT NULL,
    "ObjectKey" text NOT NULL,
    "FileName" text NOT NULL,
    "ContentType" text NOT NULL,
    "Size" bigint NOT NULL,
    "Sha256" text NOT NULL,
    "UploadedBy" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "FK_FileContents_AspNetUsers_UploadedBy" FOREIGN KEY ("UploadedBy") REFERENCES identity."AspNetUsers"("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_FileContents_Files_ProjectFileId" FOREIGN KEY ("ProjectFileId") REFERENCES projecthub."Files"("Id") ON DELETE CASCADE
);

CREATE TABLE projecthub."Milestones" (
    "Id" uuid NOT NULL CONSTRAINT "PK_Milestones" PRIMARY KEY,
    "ProjectId" uuid NOT NULL,
    "Name" character varying(120) NOT NULL,
    "OrderIndex" integer NOT NULL,
    "Description" text NOT NULL,
    "StageComplete" boolean DEFAULT false NOT NULL,
    CONSTRAINT "AK_Milestones_ProjectId_Id" UNIQUE ("ProjectId", "Id"),
    CONSTRAINT "FK_Milestones_Projects_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES projecthub."Projects"("Id") ON DELETE CASCADE
);

CREATE TABLE projecthub."Notes" (
    "Id" uuid NOT NULL CONSTRAINT "PK_Notes" PRIMARY KEY,
    "ProjectId" uuid NOT NULL,
    "Title" character varying(200) NOT NULL,
    "Body" character varying(20000) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "FK_Notes_Projects_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES projecthub."Projects"("Id") ON DELETE CASCADE
);

CREATE TABLE projecthub."Events" (
    "Id" uuid NOT NULL CONSTRAINT "PK_Events" PRIMARY KEY,
    "ProjectId" uuid NOT NULL,
    "ActorId" text NOT NULL,
    "Title" text NOT NULL,
    "Details" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "FK_Events_AspNetUsers_ActorId" FOREIGN KEY ("ActorId") REFERENCES identity."AspNetUsers"("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Events_Projects_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES projecthub."Projects"("Id") ON DELETE CASCADE
);

CREATE TABLE projecthub."CalendarEntries" (
    "Id" uuid NOT NULL CONSTRAINT "PK_CalendarEntries" PRIMARY KEY,
    "ProjectId" uuid NOT NULL,
    "ActorId" text NOT NULL,
    "Title" text NOT NULL,
    "Details" text NOT NULL,
    "OccurredAt" timestamp with time zone NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "PhotoIds" uuid[] NOT NULL,
    "PhotoContentId" uuid,
    CONSTRAINT "FK_CalendarEntries_AspNetUsers_ActorId" FOREIGN KEY ("ActorId") REFERENCES identity."AspNetUsers"("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_CalendarEntries_FileContents_PhotoContentId" FOREIGN KEY ("PhotoContentId") REFERENCES projecthub."FileContents"("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_CalendarEntries_Projects_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES projecthub."Projects"("Id") ON DELETE CASCADE
);

-- Durable cleanup jobs are part of the fresh business schema.
CREATE TABLE projecthub."StorageDeletions" (
    "Id" uuid NOT NULL CONSTRAINT "PK_StorageDeletions" PRIMARY KEY,
    "ObjectKey" text NOT NULL,
    "Attempts" integer NOT NULL DEFAULT 0,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "NextAttemptAt" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "CK_StorageDeletions_Attempts" CHECK ("Attempts" >= 0)
);

CREATE INDEX "IX_StorageDeletions_NextAttemptAt" ON projecthub."StorageDeletions" ("NextAttemptAt");

CREATE INDEX "IX_CalendarEntries_ActorId" ON projecthub."CalendarEntries" USING btree ("ActorId");

CREATE INDEX "IX_CalendarEntries_PhotoContentId" ON projecthub."CalendarEntries" USING btree ("PhotoContentId");

CREATE INDEX "IX_CalendarEntries_ProjectId_OccurredAt" ON projecthub."CalendarEntries" USING btree ("ProjectId", "OccurredAt");

CREATE UNIQUE INDEX "IX_Clients_CodePrefix" ON projecthub."Clients" USING btree ("CodePrefix");

CREATE UNIQUE INDEX "IX_Clients_UserId" ON projecthub."Clients" USING btree ("UserId");

CREATE INDEX "IX_Events_ActorId" ON projecthub."Events" USING btree ("ActorId");

CREATE INDEX "IX_Events_ProjectId_CreatedAt" ON projecthub."Events" USING btree ("ProjectId", "CreatedAt");

CREATE UNIQUE INDEX "IX_FileContents_ProjectFileId" ON projecthub."FileContents" USING btree ("ProjectFileId");

CREATE INDEX "IX_FileContents_UploadedBy" ON projecthub."FileContents" USING btree ("UploadedBy");

CREATE INDEX "IX_Files_ProjectId_FolderId" ON projecthub."Files" USING btree ("ProjectId", "FolderId");

CREATE INDEX "IX_Folders_CreatedBy" ON projecthub."Folders" USING btree ("CreatedBy");

CREATE UNIQUE INDEX "IX_Folders_ProjectId" ON projecthub."Folders" USING btree ("ProjectId") WHERE ("ParentId" IS NULL);

CREATE UNIQUE INDEX "IX_Folders_ProjectId_ParentId_Name" ON projecthub."Folders" USING btree ("ProjectId", "ParentId", "Name");

CREATE UNIQUE INDEX "IX_Folders_ProjectId_SectionKey" ON projecthub."Folders" USING btree ("ProjectId", "SectionKey");

CREATE INDEX "IX_Milestones_ProjectId_OrderIndex" ON projecthub."Milestones" USING btree ("ProjectId", "OrderIndex");

CREATE INDEX "IX_Notes_ProjectId" ON projecthub."Notes" USING btree ("ProjectId");

CREATE INDEX "IX_Projects_ClientId" ON projecthub."Projects" USING btree ("ClientId");

CREATE UNIQUE INDEX "IX_Projects_Code" ON projecthub."Projects" USING btree ("Code");

CREATE INDEX "IX_Projects_ManagerUserId" ON projecthub."Projects" USING btree ("ManagerUserId");
