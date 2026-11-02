using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class ProjectFileConfiguration : IEntityTypeConfiguration<ProjectFile>
{
    public void Configure(EntityTypeBuilder<ProjectFile> builder)
    {
        builder.HasAlternateKey(x => new { x.ProjectId, x.Id });
        builder.HasOne<DocumentFolder>().WithMany().HasForeignKey(x => new { x.ProjectId, x.FolderId }).HasPrincipalKey(x => new { x.ProjectId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId);
        builder.HasOne(f => f.Content).WithOne().HasForeignKey<FileContent>(c => c.ProjectFileId).OnDelete(DeleteBehavior.Cascade);
    }
}
