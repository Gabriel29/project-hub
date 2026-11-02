using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class MilestoneConfiguration : IEntityTypeConfiguration<Milestone>
{
    public void Configure(EntityTypeBuilder<Milestone> builder)
    {
        builder.Property(x => x.Name).HasMaxLength(120);
        builder.HasAlternateKey(x => new { x.ProjectId, x.Id });
        builder.HasIndex(x => new { x.ProjectId, x.OrderIndex });
    }
}
