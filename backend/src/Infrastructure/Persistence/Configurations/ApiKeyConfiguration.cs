using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

/// <summary>F2-24 — public API keys, one row per issued credential.</summary>
public class ApiKeyConfiguration : IEntityTypeConfiguration<ApiKey>
{
    public void Configure(EntityTypeBuilder<ApiKey> builder)
    {
        builder.ToTable("api_keys");
        builder.HasKey(k => k.Id);

        builder.Property(k => k.OrganizationId).IsRequired();
        builder.Property(k => k.Name).IsRequired().HasMaxLength(120);
        builder.Property(k => k.Prefix).IsRequired().HasMaxLength(40);
        builder.Property(k => k.KeyHash).IsRequired().HasMaxLength(128);
        builder.Property(k => k.CreatedByUserId).IsRequired();
        builder.Property(k => k.CreatedAt).IsRequired();
        builder.Property(k => k.LastUsedAt);
        builder.Property(k => k.ExpiresAt);
        builder.Property(k => k.RevokedAt);

        // Auth path looks up by hash on every request.
        builder.HasIndex(k => k.KeyHash).IsUnique();
        builder.HasIndex(k => k.OrganizationId);

        builder.HasOne(k => k.Organization)
            .WithMany()
            .HasForeignKey(k => k.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(k => k.CreatedBy)
            .WithMany()
            .HasForeignKey(k => k.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
