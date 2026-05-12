using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class OrgMembershipConfiguration : IEntityTypeConfiguration<OrgMembership>
{
    public void Configure(EntityTypeBuilder<OrgMembership> builder)
    {
        builder.ToTable("org_memberships");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.OrganizationId).IsRequired();
        builder.Property(m => m.UserId).IsRequired();
        builder.Property(m => m.Role).HasConversion<string>().HasMaxLength(20);
        builder.Property(m => m.JoinedAt).IsRequired();

        builder.HasIndex(m => new { m.OrganizationId, m.UserId }).IsUnique();

        builder.HasOne(m => m.Organization)
            .WithMany(o => o.Memberships)
            .HasForeignKey(m => m.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.User)
            .WithMany(u => u.OrgMemberships)
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
