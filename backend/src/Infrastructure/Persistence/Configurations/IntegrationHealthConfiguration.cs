using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

/// <summary>F2-25 — one health row per integration.</summary>
public class IntegrationHealthConfiguration : IEntityTypeConfiguration<IntegrationHealth>
{
    public void Configure(EntityTypeBuilder<IntegrationHealth> builder)
    {
        builder.ToTable("integration_health");
        builder.HasKey(h => h.Id);

        builder.Property(h => h.IntegrationId).IsRequired();
        builder.Property(h => h.Status)
            .HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(h => h.LastCheckedAt);
        builder.Property(h => h.LastSyncedAt);
        builder.Property(h => h.ErrorMessage).HasMaxLength(1000);

        builder.HasIndex(h => h.IntegrationId).IsUnique();

        builder.HasOne(h => h.Integration)
            .WithOne()
            .HasForeignKey<IntegrationHealth>(h => h.IntegrationId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
