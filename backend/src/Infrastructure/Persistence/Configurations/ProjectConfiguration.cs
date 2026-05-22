using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.ToTable("projects");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.OrganizationId);
        builder.Property(p => p.Name).IsRequired().HasMaxLength(120);
        builder.Property(p => p.Slug).IsRequired().HasMaxLength(80);
        builder.Property(p => p.Key).IsRequired().HasMaxLength(8);

        builder.Property(p => p.Type).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.AIControlMode).HasConversion<string>().HasMaxLength(20);

        builder.Property(p => p.TargetDate);
        builder.Property(p => p.CreatedBy).IsRequired();
        builder.Property(p => p.CreatedAt).IsRequired();
        builder.Property(p => p.IsPersonal).IsRequired().HasDefaultValue(false);
        builder.Property(p => p.OwnerUserId);

        builder.HasIndex(p => new { p.OrganizationId, p.Slug })
            .IsUnique()
            .HasFilter("\"OrganizationId\" IS NOT NULL");
        builder.HasIndex(p => new { p.OrganizationId, p.Key })
            .IsUnique()
            .HasFilter("\"OrganizationId\" IS NOT NULL");
        builder.HasIndex(p => p.OwnerUserId);

        builder.HasOne(p => p.Organization)
            .WithMany(o => o.Projects)
            .HasForeignKey(p => p.OrganizationId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.OwnerUser)
            .WithMany()
            .HasForeignKey(p => p.OwnerUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
