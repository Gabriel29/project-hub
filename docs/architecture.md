# Architecture

## Dependencies

`WebAPI → Infrastructure → Application → Domain`. Controllers call feature workflows in Infrastructure, where the shared `PortalDb`, EF Core and Identity live. Application holds request/response contracts, pure business rules, and the current-user/Identity/storage boundaries. Domain holds business entities. Domain/Application contain no EF or ASP.NET dependencies.

Feature workflows own validation, permissions and EF transaction boundaries. ProjectAccess enforces authenticated project scope; ProjectQueries and ProjectCommands separate reads from changes, with ProjectCodeAllocator handling immutable code allocation. StageService and ActivityService own independent stage and publication workflows. UploadService, DownloadService, FileService and FolderService share tree and visibility rules. ClientQueries and NoteQueries own directory/profile and note reads. WorkspaceService owns note changes and maintenance dates shared by Owner/Admin. Controllers bind HTTP requests and return typed responses.

Workflows inject `PortalDb` directly and use EF LINQ, change tracking, `SaveChangesAsync`, and `Database.BeginTransactionAsync`. Read workflows use `AsNoTracking`, including inside transactions. Project mutations acquire the project advisory lock before loading tracked state. IdentityGateway is one scoped adapter with separate session/profile, directory/account, and access-link implementation files sharing the same Identity context. Account projections use bounded query counts; project contacts select only requested accounts. EF configuration classes map individual entities. SQL/Npgsql exclusively owns schema changes.

Frontend screens call workflow hooks. API services separate authentication, user management, projects, progress, files, notes, and maintenance into directly imported feature modules. Shared HTTP transport handles credentials, serialization, and translated errors; reusable UI lives in components. `App` selects the login or authenticated workspace; `PortalWorkspace` owns the shell, while `PortalContent` handles page selection and loading/error states. Team management, notes, project editing, and portal dialogs load on demand. Project page context is constructed only after the user and project are available; team management does not require a selected project.

`usePortal` composes feature hooks and coordinates cross-feature transitions such as logout. It returns named groups instead of a flat collection of state and setters:

| Group | State owner | Responsibilities |
| --- | --- | --- |
| `session` | `useSession` | Current account, startup/setup/activation, login, language, session refresh |
| `projects` | `useProjects` | Project/client lists, selected IDs, selection actions, directory refresh |
| `project` | `useProjectDetail` + `useProjectView` | Selected project's server detail, polling, derived folders/stages/capabilities, project mutations |
| `people` | `usePeople` | Account list/loading, access link, creation, activation/reset links, enable/disable/revoke |
| `navigation` | `usePortalNavigation` | Current page/dialog, sidebar, search, folder, previews, activity being edited |
| `feedback` | `useOperationFeedback` | Pending operations, errors, timed notices |

Read values through their owner, for example `portal.session.user`, `portal.projects.selectedId`, and `portal.people.loading`. The directory exposes `selectClient`, `selectProject`, `selectSearchResult`, and `selectSavedProject` rather than raw list/selection setters. Screens do not clear server data manually. Session and People records are updated through their owner's actions. UI setters stay in navigation, where individual controls need them.

`feedback.run` handles operation feedback without refreshing data. Project actions use `project.run` to close their dialog and refresh project data; People actions refresh accounts and client selector options as needed, and profile/password changes refresh the session. Logout first completes the server request, then asks each owner to reset; failure keeps the workspace intact. Feedback generations suppress completion from operations that outlive a reset. Pending operations are counted so one completion cannot clear another operation's busy state.

Startup requests run in parallel. URL fragments are read by a pure state initializer and removed after mount so Strict Mode preserves activation/reset tokens. Project, directory, and People requests check their account/selection and request versions before committing responses. Project detail is hidden immediately when its project/account scope changes. Polling refreshes detail every 30 seconds and stops on cleanup.

People load only when management or a project form needs them. The People directory derives account totals and search/role/status filters from that response. Client selector options refresh after account creation or enable/disable actions. Project changes reset navigation's project-specific state. `useProjectView` derives document order, milestones, folders, and upload capabilities without copying server data into state. Modal focus/scroll setup stays tied to mount, while effect events provide current close and photo-navigation callbacks.


## Application composition and initialization

`Program.cs` contains only the startup sequence. `ConfigurePortalHosting` owns
port, public-origin/host and proxy configuration; `AddPortalApplication` registers
feature workflows in the WebAPI composition layer. `AddPortalWebApi` owns authorization/current-user
registration, MVC and error responses, OpenAPI and authentication rate limiting.
`UsePortalPipeline` preserves middleware order; `MapPortalEndpoints` owns controller,
OpenAPI, health and SPA fallback mappings.

`AddProjectHubInfrastructure` delegates persistence, Identity/cookie and storage/worker
registration to focused extension classes. `InitializePortalAsync` coordinates
startup: the Infrastructure database initializer applies SQL and initializes roles
under the existing advisory locks, then the storage initializer handles optional
bucket creation and upload/download/delete verification. Maintenance mode still
skips database/role initialization; storage retains its independent flags. Startup
must finish successfully before the application begins serving requests. No schema
or public HTTP contracts change in this extraction.

## Backend contracts and persistence boundaries

Application contracts are grouped into `Contracts/Requests`, `Contracts/Responses`
and `Contracts/Storage`. Requests describe input, response DTOs describe exposed
fields, and Domain entities describe persisted business state. Stream payloads such
as `StoredFile` belong to Application storage contracts. Identity/current-user and
object-storage boundaries live separately in `Abstractions/Identity` and `Abstractions/Storage`;
business exceptions live in `Errors`. Positional contract records use one
parameter per line. Contract namespaces and existing HTTP routes/JSON remain unchanged.

Workflows in `ProjectHub.Infrastructure/Services` inject the same scoped `PortalDb`
used by ASP.NET Identity. `DbContext` supplies the repository and unit-of-work
behavior directly: use DbSets/LINQ for queries, add/remove entities on the context,
and call `SaveChangesAsync`. There are no custom query/repository interfaces,
repository adapters, `IUnitOfWork`, or transaction wrappers. Read workflow classes
such as `ClientQueries` and `ProjectQueries` remain useful permission and response
boundaries; they execute their own EF queries.

Read queries use `AsNoTracking`; mutation workflows load tracked entities. A single
save already has EF's transaction guarantees. Workflows spanning multiple saves or
Identity calls use `db.Database.BeginTransactionAsync`, then save and commit via
EF's transaction. Disposal without commit rolls back. Client creation therefore
commits or rolls back the Identity account, access link and business client
together, including Identity's internal saves. Shared permission helpers enforce
manager access and client assignment without duplicating controller policies.

`PostgresQueries` contains only the reusable PostgreSQL-specific operations: folder
recursive CTEs, project advisory locks and explicit file row locks. These execute
through EF and keep raw SQL schema-qualified and parameterized. They do not wrap
ordinary DbSet operations or own saves/transactions.

File deletion adds `StorageDeletion` entities directly to the same context and
transaction as metadata changes. Upload recovery deliberately uses an independent
scope to inspect committed data after an ambiguous failure. Schema creation still
belongs exclusively to SQL/Npgsql migrations.

## Relational model and access

Identity accounts, access links and Data Protection keys live in `identity`. Business records and the SQL migration journal live in `projecthub`. Composite foreign keys keep file/folder trees within their project. Each Client has one unique Identity account; a project may be unassigned or refer to a Client. The assigned manager is an account reference, not an authorization boundary.

Owner/Admin manage all projects, folders, documents, stages and activities. Only Owner manages administrator accounts. Owner/Admin manage private project notes and maintenance dates. Assigned Clients have read access to shared sections and published activity attachments; all client uploads and folder mutations are prohibited. Project reassignment takes effect on the next request. Private notes and internal audit events never enter client responses. Inaccessible resources return 404; role violations return 403. Application entry points enforce these rules independently of controller attributes.

## Authentication and HTTP security

Bootstrap setup creates one Owner under an advisory lock. Pending clients are created with independent company labels and personal email/contact information; activation establishes credentials without renaming the company. Activation links last seven days, reset links 24 hours. Random tokens are stored only as digests and exchanged through POST bodies. Link replacement, completion, revocation and account disablement serialize on one account advisory lock. Completion is single use and commits credentials, consumption and security stamps together. Link revocation alone does not terminate sessions.

Profile, password and disabled-state changes use transactions; cookie refresh happens after commit. Reset and disabling invalidate existing sessions. Cookie security, lockout, persistent database encryption keys and per-request stamp validation remain enabled. Password requirements remain six characters, a letter and a digit.

PUBLIC_ORIGIN defines invitation URLs and the accepted browser Origin. AllowedHosts contains explicit names; forwarded headers are accepted only from configured trusted proxies/networks (plus framework loopback defaults). Mutations require X-ProjectHub-Request: 1. API responses are not cached. API failures use Problem Details with stable code and traceId extensions; frontend localization uses codes with a legacy-message fallback.

## Files and consistency

Uploads accept supported image, PDF and Office formats up to 25 MB. The HTTP boundary allocates one content buffer; Office package inspection bounds entry count and expanded size, rejects macro packages, and verifies the expected content type. These are format checks, not antivirus scanning. Downloads remain authenticated streams with sanitized display filenames.

Five fixed sections live below Root. Descendants inherit visibility; Root/private folders remain manager-only. Progress accepts supported files, but only attachments published in activities become client-visible. Activities preserve attachment order, allow up to 20 distinct same-project progress content IDs, and do not depend on stages. Published references prevent deleting or moving attached files out of progress until detached. Section roots cannot move, be renamed or deleted.

Metadata deletion queues StorageDeletions rows in the same transaction. A background worker handles bounded batches with PostgreSQL row locks and SKIP LOCKED; failures persist retry times with backoff up to one hour. Missing objects are safe to delete repeatedly. Multiple instances can process independent jobs. Upload recovery checks committed metadata in an independent scope before compensating, so ambiguous commit failures cannot delete referenced bytes; unreferenced keys are queued before immediate cleanup. Recovery failures are logged. A crash between object upload and metadata persistence can still leave an orphan; general orphan reconciliation remains future work.

## Startup and schema lifecycle

Startup validates database/storage/host configuration, applies embedded SQL migrations through Npgsql, and initializes required roles under a separate advisory lock, checking Identity results. Optional bucket creation and storage round-trip verification finish before serving. Maintenance mode skips schema/role initialization and cleanup workers. /health checks database connectivity.

For the user-authorized fresh installation, the two initial scripts create the identity/business baselines, including durable storage deletions in 0002. Applied SQL migrations remain immutable outside this explicit fresh-baseline replacement. Subsequent changes append ordered SQL files and update EF configurations separately. No EF migrations, automatic database resets, or object-storage resets are used. See [database migrations](database-migrations.md) and [backend audit](backend-audit.md).

## Project resources and folder navigation

The project GET returns only project metadata/stages/contacts plus an Owner/Admin root folder ID. `ProjectResourcesController` and `ProjectResources` expose sections, immediate folder contents, recursive folder search, published activities with attachment metadata, bounded recent documents, and manager-only audit events. Folder ancestry is read with a project-scoped PostgreSQL recursive CTE; the ordinary contents query loads files and folders only at that location. Search explicitly reads the requested subtree. No schema changes are required.

The frontend loads section entry points separately and requests a folder only when its tab or location is selected. Dashboard uses three activity previews and six recent documents; Progress requests its activity feed without browsing the private folder as Client. File Manager and section tabs share the same folder-content API. Breadcrumbs and move destinations no longer require downloading the complete tree. Each resource hook hides old data immediately when account, project or location changes and ignores late responses. Folder/search errors have retry controls; successful mutations refresh the current resource.

## Client directory boundaries

`ClientsController` owns `/api/clients` for the Owner/Admin management directory and `/api/clients/me` for the authenticated Client's own safe profile. Application guards supplement controller authorization. Directory records retain internal labels and code prefixes for management use; the Client profile is a separate DTO and SQL projection containing only business-record ID and personal display name/email/phone. It cannot select another account by request ID. `/api/auth/me` remains the session identity response. The SPA calls the directory only for managers, and directory state and in-flight responses are scoped to both account and management role. Shared project endpoints continue to enforce assignment/visibility; Client project responses withhold manager account IDs, client management contact fields, and the private root folder ID.
