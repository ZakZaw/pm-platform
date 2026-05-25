using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class EpicDependencyConfiguration : IEntityTypeConfiguration<EpicDependency>
{
    public void Configure(EntityTypeBuilder<EpicDependency> builder)
    {
        builder.ToTable("epic_dependencies");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.EpicId).IsRequired();
        builder.Property(d => d.DependsOnEpicId).IsRequired();
        builder.Property(d => d.CreatedAt).IsRequired();

        // No duplicate edges; one row per ordered pair.
        builder.HasIndex(d => new { d.EpicId, d.DependsOnEpicId }).IsUnique();
        builder.HasIndex(d => d.DependsOnEpicId);

        builder.HasOne(d => d.Epic)
            .WithMany(e => e.DependsOn)
            .HasForeignKey(d => d.EpicId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict so that deleting the prerequisite epic doesn't silently
        // drop another epic's blocker — the command handler must remove the
        // dependency first.
        builder.HasOne(d => d.DependsOnEpic)
            .WithMany(e => e.DependedOnBy)
            .HasForeignKey(d => d.DependsOnEpicId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
