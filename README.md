# ProjectHub Client Portal

Generic project portal built with React/TypeScript and ASP.NET Core 10. Names, domains and branding assets are neutral placeholders for a new installation. The ProjectHub SQL baseline targets empty databases; existing installations need a separate migration plan. One container serves the UI and authenticated REST API; PostgreSQL stores relational data, and a private S3 bucket stores files.

## Structure

- `client/src/app`: portal composition and navigation.
- `client/src/pages`: one screen per rail tab, plus login/activation/reset.
- `client/src/components`: reusable UI and forms, with co-located component CSS.
- `client/src/styles`: global theme tokens, element defaults, and shared utility styles.
- `client/src/logic`: workflow hooks, dialog actions, and presentation utilities.
- `client/src/services/api`: feature services for auth, users, projects, progress, files, notes, and maintenance, with shared HTTP transport and error translation.
- `client/src/types`: shared typed contracts; `client/public/brand` contains neutral ProjectHub SVG branding and a decorative workspace placeholder.
- `ProjectHub.Domain`: framework-independent entities.
- `ProjectHub.Application`: pure rules, request/response DTOs, authentication service and identity/storage/current-user boundaries; references Domain only.
- `ProjectHub.Infrastructure`: feature workflows using the shared EF context directly, PostgreSQL SQL migrations, entity mappings, ASP.NET Identity, cookie encryption persistence, S3 adapters, and registration.
- `ProjectHub.WebAPI`: thin controllers, HTTP contracts, authorization, security middleware, and host composition.

Read [architecture](docs/architecture.md), [operations](docs/operations.md), [API](docs/api.md), and [localization](docs/localization.md), and [frontend coding style](docs/frontend-style.md).

## Accounts and projects

The setup screen requires only the private bootstrap key, real name/email, optional phone, and a chosen password. No default Owner account or initial password is created. Email becomes the login username; setup closes permanently afterward. Passwords require six characters, one letter, and one digit.

Owner/Admin create clients with an identification label, contact name, email, and optional phone, then copy the seven-day activation link for manual delivery. Activation prefills contact details and lets the client choose their personal name and password. The owner’s identification label stays separate. Reset links last 24 hours and change only the password. Links are single-use, stored as digests, and superseded when regenerated. Reset invalidates existing sessions. No emails are sent automatically.

Each project has one client or **Fara Client**. Clients see only their project selector and their own projects. Owner/Admin see client and project selectors and **Create Project** in the header. Creation and assignment are atomic. Only Owner creates/manages administrator accounts.

## Project workspace

The client rail contains Dashboard, Progres și foto, Documente Contractuale, Garanție & Utilizare, Mentenanță & Intervenții, and Aprobări și documentații tehnice. Owner/Admin additionally see Manager fișiere; user management is in the account hamburger. Only Owner sees project-scoped Notițe and Editează proiectul. Project editing opens a dedicated page below Notițe in the rail. Stable page identifiers are independent of Romanian labels. The dashboard shows the description, client contact for Owner or manager contact for Client/Admin (name, email and phone), stage sequence, recent updates, and links into shared document sections. Undefined stages are hidden from clients; progress posts do not require a stage. Account settings use left-side Account details and Security tabs. Account details edit email, name, phone and language after current-password confirmation; the saved email is used for login. Security changes the password. Stages are horizontal on desktop and vertical on mobile; no percentage is stored or computed.

Project creation requires a name, description, client assignment (including Fara Client), and an active Owner/Admin manager account. Manager contact comes from that account. Codes reserve a client-specific two-letter prefix and a global number beginning at 1000 under a database lock. Codes remain unchanged when editing or reassigning projects.

Owner/Admin define stages and publish/edit activities in Progres și foto. Posts contain title, description, and up to 20 same-project progress attachments. The form has no date, stage, or cover checkbox. Photos open the full-gallery viewer; documents use the file preview/download controls. Activity editing shows current and newly selected attachments in one preview section with an add-files tile. Owner/Admin can delete an activity after confirmation; stored files remain intact.

Every project creates Root and five system folders: `.progress`, `.contracts`, `.warranty`, `.maintanance`, and `.technicaldocs`. The frontend displays their localized section labels. Stable section keys identify them independently of their labels. Missing folders are recreated/adopted during an authorized category upload inside a project tree lock. Default roots cannot be moved or deleted.

Folder behavior is declared once in Application/SharedFolders.cs through FolderPolicy: client visibility, client uploads, image-only content, and published-photo access. Policies inherit through descendants. Project detail exposes the section definitions plus each folder's clientVisible, clientCanUpload, canUpload (current user), and imagesOnly fields. The UI consumes these capabilities, including when a category folder is missing. All five shared sections and their descendants are client read-only. Section tabs expose folder browsing; Owner/Admin can upload and create folders directly in every section tab and in File Manager. Owner/Admin manage files; Owner alone manages notes, administrator accounts.

Manager fișiere displays defaults in a wrapping grid with spacing before private content. Default folder icons use a darker orange with a person marker for client sharing, ordinary folders a lighter orange, and files use type-specific grey icons. Folder/file menus support previews, downloads, movement, and deletion with server-side authorization, cycle checks, and confirmation. Folder moves change inherited client access. Internal audit events and private Root content are excluded from client responses.

The `.progress` system folder remains visible under its localized label in File Manager. Managers can upload photos there directly or through activity authoring. Activity attachments must come from that same project's progress subtree. Unpublished attachments remain manager-only. Published attachments are downloadable by the assigned client. Referenced files must be detached from activities before deletion or movement outside progress storage.

Mentenanță & Intervenții shows the next maintenance date with an Owner-only update button beside the heading. The button opens a date popup backed by the dedicated maintenance-date API; project creation and editing do not change that date. Mentenanță & Intervenții combines its folder explorer with dated intervention history. Owner/Admin publish, edit, and delete entries with a title, description, and maintenance-subtree file attachments. Clients read the history. Attached files must be detached before deletion or moving outside maintenance. Notițe stores plain-text project notes with title, body, and timestamps; dedicated endpoints and UI are Owner-only. The former approve/reject workflow is retired; section 6 is a document view.

Files have one content record and no revision history. Metadata deletion atomically queues storage cleanup; a background worker retries failed object deletions across restarts. The SQL baseline excludes FileCleanupKeys, NotificationReads, project cover and stage columns, and activity stage references. Milestones store StageComplete. Retired workflow and archive tables are absent.

Identity users, roles, claims, tokens, access links, and encryption keys live in the PostgreSQL identity schema. Business identity references have foreign keys, and composite references enforce same-project folders.

## Development and tests

Copy `.env.example` to `.env`, then run `docker compose up --build` for the complete local stack with API restart on edits and Vite hot reload. Open http://localhost:5173; PostgreSQL is on localhost:5432 and SeaweedFS S3 on localhost:8333. The API creates the development bucket and applies migrations automatically. `.env.example` is the source of development defaults, including setup key `adminkey` and database/storage credentials `local-development-only`. Compose reads configurable values from `.env` through `${...}` references. `docker compose down` preserves data volumes.

For host-based development, run `docker compose up -d postgres storage`, export the values from `.env` with `DATABASE_URL` using `Host=localhost`, `AWS_ENDPOINT_URL=http://localhost:8333`, and `API_PROXY_TARGET=http://localhost:8080`, then run `dotnet run --project src/ProjectHub.WebAPI` and `npm ci && npm run dev` in `client`. The app creates the development bucket when `CREATE_STORAGE_BUCKET_ON_STARTUP=true`. See [storage](docs/storage.md) for SeaweedFS configuration, verification and migration from MinIO.

Backend integration tests require `DATABASE_URL` pointing to a local database named **projecthub_test**. Each test creates and removes its own database; non-local connections and other base database names are rejected. Run `dotnet test tests/ProjectHub.Tests`. Frontend: `npm run check` (lint, formatting, component tests, production build), `npm run build`, `npx playwright install chromium webkit`, and `npm run test:e2e`. GitHub Actions runs backend, component, and desktop/mobile browser checks.

## Deployment

Dokploy builds the root Dockerfile using the standalone `compose.dokploy.yml`. Configure the database/storage credentials from `.env.production.example`, enable Isolated Deployments, and route an HTTPS domain to service `web` on port `80`. See [Dokploy rollout](docs/dokploy.md) for investigation, validation, and rollback steps. The legacy Railway configuration is retained for reference.

`/health` checks PostgreSQL; startup verifies S3 upload/download/delete before serving. Embedded PostgreSQL SQL scripts run through the .NET/Npgsql migration runner before normal serving. EF handles data access only. The current baseline requires an empty database; existing EF-managed installations need an explicit SQL transition. See [database migrations](docs/database-migrations.md) and the mandatory rules in [AGENTS.md](AGENTS.md).

## Languages

The frontend supports English and Romanian using i18next/react-i18next catalogs. Each user has a string `language` preference (`en`/`ro`); absent or unsupported frontend values use English. Users save their preference in account settings; managers choose it when creating accounts. Access pages start in English and offer English/Romanian flags for page display only. Setup and activation include a separate field for the saved account language; sign-in always restores the account’s saved preference. See [localization](docs/localization.md) for structure, migration and extension guidance.

Project status includes an automatic final **All stages completed / Toate etapele finalizate** option whenever stages exist. Selecting it marks every stage completed and persists across reloads. Selecting a regular stage reopens progress. Completion is stored per milestone; the current stage and overall completion are derived from those flags. Activity photo carousels show the image and navigation arrows with an orange download control over the current photo; captions and post titles are omitted.

Recent documents lists the six newest authorized files from shared tab folders and their descendants, excluding Progress and photos and all its descendants. Private File Manager content is also excluded. The file icon/title previews images and PDFs or downloads other file types. Separate right-aligned controls download the file and navigate to its owning tab. Only Owner sees the document section’s View all button, which opens File Manager.

Document searches include the current folder and every descendant, returning matching folder names, file titles, and original filenames. Matching ignores case and Romanian diacritics. Results show their location and files have an Open location action. Section tabs keep searches within their section; folders can be opened and navigated with breadcrumbs. Clearing search restores the normal listing.

## Backend standards

See [backend audit](docs/backend-audit.md) for the file-by-file review, [architecture](docs/architecture.md) for responsibilities and permissions, and [operations](docs/operations.md) for public-origin/proxy configuration and durable cleanup monitoring. Run `dotnet format whitespace ProjectHub.sln --no-restore --verify-no-changes` and `dotnet format style ProjectHub.sln --no-restore --verify-no-changes --diagnostics IDE0005 IDE0011 IDE0040 IDE0161` alongside the Release test suite.
