using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class StorageDeletionConfiguration : IEntityTypeConfiguration<StorageDeletion>
{
    public void Configure(EntityTypeBuilder<StorageDeletion> builder)
    {
        builder.ToTable("StorageDeletions", "projecthub");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.NextAttemptAt);
    }
}
