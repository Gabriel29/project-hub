using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ProjectHub.Infrastructure;

public sealed class PortalUserConfiguration : IEntityTypeConfiguration<PortalUser>
{
    public void Configure(EntityTypeBuilder<PortalUser> builder)
    {
        builder.Property(x => x.Language).HasMaxLength(2).HasDefaultValue("en");
        builder.ToTable("AspNetUsers", "identity");
        builder.HasIndex(x => x.NormalizedEmail).IsUnique();
    }
}
