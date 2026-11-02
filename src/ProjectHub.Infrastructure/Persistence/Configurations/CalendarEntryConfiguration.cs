using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class CalendarEntryConfiguration : IEntityTypeConfiguration<CalendarEntry>
{
    public void Configure(EntityTypeBuilder<CalendarEntry> builder)
    {
        builder.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId);
        builder.HasOne<PortalUser>().WithMany().HasForeignKey(x => x.ActorId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<FileContent>().WithMany().HasForeignKey(x => x.PhotoContentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => new { x.ProjectId, x.OccurredAt });
    }
}
