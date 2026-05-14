using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class InvitationConfiguration : IEntityTypeConfiguration<Invitation>
{
    public void Configure(EntityTypeBuilder<Invitation> builder)
    {
        builder.ToTable("invitations");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.OrganizationId).IsRequired();
        builder.Property(i => i.Email).IsRequired().HasMaxLength(254);
        builder.Property(i => i.Role).HasConversion<string>().HasMaxLength(20);
        builder.Property(i => i.Token).IsRequired().HasMaxLength(128);
        builder.Property(i => i.ExpiresAt).IsRequired();
        builder.Property(i => i.CreatedAt).IsRequired();
        builder.Property(i => i.CreatedById).IsRequired();
        builder.Property(i => i.AcceptedById);

        // Random 32-byte token, base64url. Unique across the table.
        builder.HasIndex(i => i.Token).IsUnique();

        // Used by both the duplicate-active check on Create and the
        // already-member-by-email check via Users.
        builder.HasIndex(i => new { i.OrganizationId, i.Email });

        builder.HasOne(i => i.Organization)
            .WithMany()
            .HasForeignKey(i => i.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(i => i.CreatedBy)
            .WithMany()
            .HasForeignKey(i => i.CreatedById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
