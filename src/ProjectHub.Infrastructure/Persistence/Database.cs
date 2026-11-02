using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public class PortalDb(DbContextOptions<PortalDb> options) : IdentityDbContext<PortalUser>(options), IDataProtectionKeyContext
{
    public DbSet<DataProtectionKey> DataProtectionKeys { get; set; } = null!;
    public DbSet<ProjectNote> Notes => Set<ProjectNote>();
    public DbSet<DocumentFolder> Folders => Set<DocumentFolder>();
    public DbSet<CalendarEntry> CalendarEntries => Set<CalendarEntry>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Milestone> Milestones => Set<Milestone>();
    public DbSet<ProjectFile> Files => Set<ProjectFile>();
    public DbSet<FileContent> Contents => Set<FileContent>();
    public DbSet<ProjectEvent> Events => Set<ProjectEvent>();
    public DbSet<AccessLink> AccessLinks => Set<AccessLink>();

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        try
        {
            return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is Npgsql.PostgresException { SqlState: "23505" })
        {
            throw new ProjectHub.Application.PortalException(409, "valueExists");
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ProjectHub.Application.PortalException(409, "concurrentChange");
        }
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.HasDefaultSchema("projecthub");
        b.ApplyConfigurationsFromAssembly(typeof(PortalDb).Assembly);
    }
}
