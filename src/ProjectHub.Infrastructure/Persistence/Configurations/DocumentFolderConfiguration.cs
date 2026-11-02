using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class DocumentFolderConfiguration : IEntityTypeConfiguration<DocumentFolder>
{
    public void Configure(EntityTypeBuilder<DocumentFolder> builder)
    {
        builder.Property(x => x.SectionKey).HasMaxLength(32);
        builder.HasIndex(x => new { x.ProjectId, x.SectionKey }).IsUnique();
        builder.Property(x => x.Name).HasMaxLength(120);
        builder.HasIndex(x => new { x.ProjectId, x.ParentId, x.Name }).IsUnique();
        builder.HasOne<DocumentFolder>().WithMany().HasForeignKey(x => new { x.ProjectId, x.ParentId }).HasPrincipalKey(x => new { x.ProjectId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => x.ProjectId).IsUnique().HasFilter("\"ParentId\" IS NULL");
        builder.HasAlternateKey(x => new { x.ProjectId, x.Id });
        builder.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId);
        builder.HasOne<PortalUser>().WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
    }
}
