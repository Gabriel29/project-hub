# API

All requests are same-origin. Mutations require `X-ProjectHub-Request: 1`; authenticated routes use the encrypted session cookie. Errors return `application/problem+json` with `status`, `title`, `detail` when available, `instance`, stable `code`, and `traceId`; validation failures also contain field `errors`. Clients localize codes rather than server message strings. The frontend sends its selected `en`/`ro` language in `Accept-Language`; ASP.NET Core localizes error details and field validation messages with `IStringLocalizer<PortalErrorMessages>` and `.resx` resources under `src/ProjectHub.WebAPI/Resources/`. English is the default for missing/unsupported languages. Exceptions carry only status and stable code; Identity failures are mapped to these codes. Raw exception/Identity descriptions are never returned to clients. Project stages are generic data. Shared document sections have stable keys independent of their labels.

## Authentication and accounts

- `GET /api/auth/setup-status`: `{required}`.
- `POST /api/auth/setup`: `{token,name,email,password,phoneNumber?}` creates the real Owner once, under an advisory lock.
- `POST /api/auth/login`: `{email,password}` for activated, enabled accounts; only email is accepted.
- `POST /api/auth/activation-details`: `{token}` returns only `{name,email,phoneNumber}` for a valid, unconsumed activation link. Invalid, expired, revoked or disabled links are denied.
- `POST /api/auth/activate`: `{token,name,email,password,phoneNumber?}`; seven-day single-use activation establishes a session.
- `POST /api/auth/reset`: `{token,password}`; 24-hour single-use reset rejects email changes and invalidates sessions.
- `GET /api/auth/me`: account including `phoneNumber`, roles, password/enabled state and optional client ID.
- `PUT /api/auth/phone`: `{phoneNumber}` updates the authenticated account's phone; null/blank clears it.
- `POST /api/auth/password`: `{currentPassword,password}` verifies the existing password.
- `POST /api/auth/logout`.

Owner/Admin manage accounts through `/api/admin/users`. Client creation accepts `{name,clientName,email,phoneNumber?}` and returns `{id,clientId,link:{id,expiresAt,url}}` for pending clients. Only Owner may create administrators with `{name,admin:true,email,phoneNumber?}`. New administrators also receive a seven-day activation link and choose their password during activation. Only Owner can generate or revoke activation/reset links for administrators; Owner/Admin retain link management for clients. Existing disabled-state routes remain available. Clients cannot manage accounts.

## Client directory and own details

- `GET /api/clients`: Owner/Admin only. Returns management directory entries `{id,displayName,email,code}`; `displayName` is the internal business label and `code` is the allocation prefix. Client requests receive 403; anonymous requests receive 401. The former `/api/projects/clients` route is removed.
- `GET /api/clients/me`: Client role only. Returns exactly `{id,displayName,email,phoneNumber}`, projected from the client record linked to the authenticated user and their personal contact fields. It excludes internal business labels, code prefixes, roles, account/security state, and management links. Caller-supplied client/user IDs are ignored; there is no client-facing lookup by arbitrary ID. Owner/Admin receive 403.
- `GET /api/auth/me` remains the session/account profile used for authentication and account settings. It is distinct from the client record endpoint.

Client sessions load assigned projects directly through `/api/projects`; they never fetch the management directory. Directory state is cleared/hidden when the session or management role changes and late responses are ignored.

## Projects and stages

- `GET /api/projects?clientId=<uuid|none>`: accessible project summaries. No filter returns all accessible projects; `none` represents Fara Client.
- `GET /api/projects/{id}`: `{project,rootFolderId}` only. Project includes stages and relevant contacts. Owner/Admin receive the project root folder ID; Clients receive null. Client project details also omit the internal manager account ID (`managerUserId` is null), while retaining the intended manager name/email/phone contact fields. Documents, folders, activities, and internal events are not included.
- `GET /api/projects/{id}/sections`: accessible tab entry points, including `key`, `folderId`, and capabilities. Clients receive shared document sections; Progress is browsable only by Owner/Admin. Labels are translated from stable section keys.
- `GET /api/projects/{id}/folders/{folderId}/contents`: `{folder,breadcrumbs,folders,files,paths}`. Returns only immediate child folders and files; `paths` is empty. Breadcrumbs include the current folder; Client breadcrumbs stop at the shared section and never expose the private project root. File payloads contain metadata, never stored file contents.
- `GET /api/projects/{id}/folders/{folderId}/search?query=...`: explicit recursive search within that folder. Same response shape; `paths` contains ancestors needed to display/open result locations. Queries must have 1–120 characters and match names case/accent-insensitively.
- `GET /api/projects/{id}/activities`: `{updates,files}`; files contain metadata only for the returned published attachments. Optional `?limit=3` supplies Dashboard previews. Clients cannot browse the underlying Progress folder, but retain access to published attachments.
- `GET /api/projects/{id}/recent-documents`: `{files,folders}` for the six newest documents in shared document sections, with only the folder paths needed by those results. Excludes Progress and private File Manager documents.
- `GET /api/projects/{id}/events`: Owner/Admin internal audit events; Clients receive 403.

Every resource endpoint independently verifies project access and folder visibility. Unknown, private, cross-project and unassigned folder locations return 404. Opening a tab loads its section root contents; opening a child or breadcrumb loads that location. File Manager starts at `rootFolderId` and uses the same contents endpoint. Search is a separate request, not an expanded contents response. Move destinations are browsed lazily. Requests and refreshes are scoped to user/project/location so late responses cannot replace the current location. Mutations refresh the active resource; inactive tabs load fresh data when opened.
- Owner/Admin `POST /api/projects` and `PUT /api/projects/{id}` accept `{name,location,description?,managerUserId,clientId}`. Description is optional; the selected manager must be an active Owner/Admin account. `clientId` must be present; null means Fara Client. Codes are server-generated and immutable. Codes combine a client-specific consonant/first-letter/random prefix with a separate sequence per client prefix starting at 1000. Creation takes an advisory lock to prevent duplicate prefixes or indices. Manager name/phone are read from the linked account.
- Owner/Admin `PUT /api/projects/{id}/status`: `{stageId,stagesCompleted?}` selects a same-project stage or the final completion state. Send `{stageId:null,stagesCompleted:true}` to finish all stages; at least one stage must exist. Choosing a regular stage marks all earlier milestones complete and that stage and all later stages incomplete. Each milestone exposes persisted `stageComplete`; project `stageId` (first incomplete milestone) and `stagesCompleted` are derived response fields, with no corresponding project columns. No percentage is stored.
- Owner/Admin `PUT /api/projects/{id}/stages`: array of `{id,name,description}`. Null IDs create stages; array position sets the order. At most 50 stages. Stages can be removed independently of activities. Completion is normalized to a consecutive prefix after reordering.
- Owner/Admin `PUT /api/projects/{id}/milestones`: `{id,description}[]` covering all stages.

## Progress and photos

Owner/Admin `POST /api/projects/{id}/updates` and `PUT /api/projects/{id}/updates/{entryId}` accept `{title,details,occurredAt?,photoIds?,photoContentId?}`. Attachment IDs identify same-project progress content, with a maximum of 20 per activity. `photoIds` preserves gallery order; `photoContentId` is the first photo and can be supplied alone for a single-photo activity. Upload images with `calendarPhoto=true`; they live in the visible Progres și foto folder and appear in File Manager. Supported progress-subtree files may be attached to activities; clients receive published attachments only.

## Documents

Default folders are directly under each project's Root: `progress` → Progres și foto, `contracts` → Documente Contractuale, `warranty` → Garanție & Utilizare, `maintenance` → Mentenanță & Intervenții, `technical` → Aprobări și documentații tehnice. Project creation creates all five folders atomically alongside Root. Folder DTOs include `{id,name,parentId,sectionKey,clientVisible,clientCanUpload,canUpload,imagesOnly}`. Descendants inherit their policy through ancestry. `sections` includes `{key,name,clientVisible,clientCanUpload,canUpload,imagesOnly}` for every default, even missing folders. `canUpload` is computed for the current actor. All five shared sections and their descendants are client read-only. Private folders are manager-only. Progress accepts supported document and image formats and exposes only published activity attachments to clients. Change these rules in Application/SharedFolders.cs; frontend capabilities come from this API.

- Owner/Admin `POST /api/projects/{id}/files/folders`: `{name,parentId?,sectionKey?}`. Names allow Romanian letters, numbers, spaces, and ordinary punctuation; path separators, leading dots, and control characters are rejected. Omitted parent uses the selected section or Root. Default root folders and Root are protected.
- `POST /api/projects/{id}/files`: multipart `file,title,folderId?,sectionKey?,calendarPhoto?`, maximum 25 MB. Returns `{id,contentId}`. Every upload creates an independent file; legacy `fileId` revision requests are rejected. A section key resolves/creates its fixed folder under a project tree lock. If a folder is also supplied, it must be inside that section. Owner/Admin only: client requests are rejected with 403 before processing file content or creating section folders. Read-only policy applies to every client-visible section and descendant and cannot be overridden by request fields. Managers retain uploads in File Manager and activity authoring.
- File DTOs contain `{id,title,folderId,content,calendarPhoto}`. Content contains `{id,fileName,contentType,size,createdAt,sha256}`. Published images outside shared folders are included for gallery rendering and excluded from ordinary document browsing.
- Owner/Admin `PUT /api/projects/{id}/files/{fileId}/folder`: `{folderId}`; null selects Root.
- Owner/Admin `PUT /api/projects/{id}/files/folders/{folderId}/parent`: `{folderId}`; null selects Root. Moving into self/descendants or foreign folders is rejected. Shared section roots cannot move.
- Owner/Admin `DELETE /api/projects/{id}/files/{fileId}` and `DELETE /api/projects/{id}/files/folders/{folderId}` delete files or subtrees. Root and default section roots are protected. Activity references prevent attachment deletion and movement outside progress until detached. Image-only destination rules also apply to file/subtree moves.
- `GET /api/projects/{id}/files/{fileId}/content`: authenticated download. `inline=true` permits same-origin images/PDF previews. Clients can retrieve only shared files or published activity attachments; other files return 404.
- Metadata deletion transactionally enqueues object keys. A background worker retries failed storage deletion durably; successful API deletion does not require immediate storage availability.

## Private notes

Owner/Admin `GET`, `POST` at `/api/projects/{id}/notes`; `PUT`, `DELETE` at `/api/projects/{id}/notes/{noteId}`. Writes accept `{title,body}` (200/20,000 characters). Reads return `{id,title,body,createdAt,updatedAt}[]`, most recently updated first. Notes load separately and are absent from project metadata and public events. Client access returns 403.

## Maintenance

Maintenance is a shared document view. Intervention-history endpoints are retired and return 404. Owner/Admin change the optional maintenance date using `PUT /api/projects/{id}/maintenance-date`; general project editing leaves it unchanged. Assigned clients can read the date. An absent date produces no dashboard card.

The former `/approvals` and `/approvals/{id}/resolve` routes are removed. Audit read-marker endpoints are retired.

All project access checks are server-side. Inaccessible projects/files return 404; role violations return 403. Cross-project references and conflicting folder/section combinations are rejected.

`PUT /api/auth/profile` accepts `{name,email,phoneNumber,currentPassword,language?}` for the authenticated account only. The current password is verified; duplicate emails are rejected; the updated email is used for login. The session is refreshed and other sessions invalidated. Client labels remain unchanged. `GET /api/auth/me` omits username; manager user lists additionally include `clientName`.

Client creation requires separate `clientName` (manager identification label), `name` (contact person), and `email`, with optional `phoneNumber`. Invitations prefill contact details; activation/profile changes update the personal identity without renaming the project client record.

Activities have no stage reference and can be published when there are no stages. Dashboard hides undefined stages from clients. User management is accessed through the account hamburger instead of the project rail.

Activity photo arrays preserve selection order and remove duplicates; `photoContentId` identifies the first carousel photo. Activity responses always return a consistent `photoIds` array. Both progress and Dashboard show up to three photo previews after title and description, with an extra-photo count. Clicking a preview opens the complete activity gallery at that photo; the full-photo dialog contains the carousel. Single-file previews stay independent of activity galleries.

Downloads use the document display title plus its original validated extension. The server sanitizes unsafe filename characters, control/bidi characters and reserved names, and caps the UTF-8 filename length; the original upload filename remains in file metadata. Inline previews include the same suggested filename while retaining inline rendering. Shared section tabs show child folders alongside the document overview. Opening a folder scopes the overview to its subtree; breadcrumbs return to the section root. Progress and Photos includes the same explorer alongside published activities, respecting existing published-photo permissions. Owner/Admin can upload files and create folders in every section tab and in File Manager; clients see neither control. Folder creation in either view updates the same project tree, so new shared folders appear in both views.

Activity creation accepts title, details and up to 20 same-project progress-folder attachment content IDs (`photoIds`). The server assigns the publication date when none is provided; edits preserve that date. The activity UI no longer asks for stage, date or cover selection. Images use the gallery, other attachments use file tiles with preview/download. The fresh baseline contains only current tables; retired intervention and approval archives are absent.

`PUT /api/projects/{id}/maintenance-date` accepts `{date:"YYYY-MM-DD"}` or `{date:null}`. Owner/Admin; inaccessible projects return 404. It changes only the maintenance date. General project creation and editing do not accept or change this date. Intervention models, services, attachment guards, frontend screens and client APIs are removed. The current baseline has no intervention archive tables; shared maintenance documents remain supported.

`DELETE /api/projects/{id}/updates/{entryId}` deletes one activity for Owner/Admin. The activity must belong to the selected project. Stored files are retained; progress photos without remaining activity references become manager-only.

## Account link state and browsing

Manager user DTOs include `activeLinkExpiresAt`, null when no unconsumed, unrevoked, unexpired link exists. The UI offers activation for pending accounts and password recovery for activated accounts, including administrators when managed by Owner; revoke is shown only while a valid link exists. Generating, completing, and revoking links serialize on the same account lock. Revoking a link does not terminate current sessions. Recovery asks only for the new password and confirmation; account details are unchanged. Managers do not select a language when creating users; the user chooses during activation or in account settings.

Progress displays activities only. Activity images remain stored in `.progress`, accessible to managers through File Manager. Other section tabs display direct child folders and files; search includes descendants and shows their paths. The folder tree is shared between each tab and File Manager.

Note cards have a fixed height and clamped title/body previews. Selecting the card opens the full note in a dialog; Edit and Delete are in its three-dot menu. Owner/Admin permissions are enforced at the API.

The PostgreSQL SQL baseline omits the obsolete `Files.Description` column. Existing project codes are preserved; subsequent allocations use their client prefix's sequence.

Owner/Admin `PUT /api/projects/{projectId}/files/{fileId}/name` accepts `{title}` (trimmed, 1–200 characters). It renames the displayed document title and updates the project timestamp while preserving the original uploaded filename, content, references, and folder. Other users receive 403; mismatched project/file IDs receive 404. Search-result folder paths appear on hover instead of as text below the title.

Owner/Admin `PUT /api/projects/{projectId}/files/folders/{folderId}/name` accepts `{name}` using the same naming rules as folder creation (1–120 characters). Root and system section folders cannot be renamed. Duplicate names within the same parent are rejected. Rename preserves folder IDs, descendants, files, and inherited access permissions.

## Hosting and error compatibility

PUBLIC_ORIGIN supplies invitation URLs independently of request Host headers. AllowedHosts and trusted proxy configuration must match deployment routing. Origin checks compare scheme, host and port. Existing routes and successful JSON shapes are preserved. Error consumers should use code first, validation errors second, and detail as a fallback. HTTP 401/403/404/409/413/429/503 responses use the same Problem Details envelope; traceId correlates unexpected failures with server logs.
