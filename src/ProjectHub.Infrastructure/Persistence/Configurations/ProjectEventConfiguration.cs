using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class ProjectEventConfiguration : IEntityTypeConfiguration<ProjectEvent>
{
    public void Configure(EntityTypeBuilder<ProjectEvent> builder)
    {
        builder.HasOne<PortalUser>().WithMany().HasForeignKey(x => x.ActorId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId);
        builder.HasIndex(x => new { x.ProjectId, x.CreatedAt });
    }
}
