using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ProjectHub.Infrastructure;

public sealed class AccessLinkConfiguration : IEntityTypeConfiguration<AccessLink>
{
    public void Configure(EntityTypeBuilder<AccessLink> builder)
    {
        builder.ToTable("AccessLinks", "identity");
        builder.HasIndex(x => x.TokenHash).IsUnique();
        builder.HasOne<PortalUser>().WithMany().HasForeignKey(x => x.UserId);
    }
}
