using Microsoft.EntityFrameworkCore;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

internal static class PostgresQueries
{
    public static Task<List<DocumentFolder>> FolderAncestorsAsync(this PortalDb db, Guid projectId, Guid folderId, CancellationToken ct = default) => db.Folders.FromSqlInterpolated($"""
        WITH RECURSIVE tree AS (
            SELECT * FROM projecthub."Folders" WHERE "ProjectId" = {projectId} AND "Id" = {folderId}
            UNION
            SELECT parent.* FROM projecthub."Folders" parent JOIN tree child ON parent."Id" = child."ParentId" AND parent."ProjectId" = child."ProjectId"
        ) SELECT * FROM tree
        """).AsNoTracking().ToListAsync(ct);

    public static Task<List<DocumentFolder>> FolderDescendantsAsync(this PortalDb db, Guid projectId, Guid folderId, CancellationToken ct = default) => db.Folders.FromSqlInterpolated($"""
        WITH RECURSIVE tree AS (
            SELECT * FROM projecthub."Folders" WHERE "ProjectId" = {projectId} AND "Id" = {folderId}
            UNION
            SELECT child.* FROM projecthub."Folders" child JOIN tree parent ON child."ParentId" = parent."Id" AND child."ProjectId" = parent."ProjectId"
        ) SELECT * FROM tree
        """).AsNoTracking().ToListAsync(ct);

    public static async Task LockProjectAsync(this PortalDb db, Guid projectId, CancellationToken ct = default) => await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({projectId.ToString()}, 71450284))", ct);

    public static async Task LockProjectCodesAsync(this PortalDb db, CancellationToken ct = default) => await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(71450283)", ct);

    public static Task<ProjectFile?> LockFileAsync(this PortalDb db, Guid id, Guid projectId, CancellationToken ct) => db.Files.FromSqlInterpolated($"SELECT * FROM projecthub.\"Files\" WHERE \"Id\" = {id} AND \"ProjectId\" = {projectId} FOR UPDATE").AsTracking().SingleOrDefaultAsync(ct);
}
