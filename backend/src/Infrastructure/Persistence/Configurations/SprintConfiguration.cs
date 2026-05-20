using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class SprintConfiguration : IEntityTypeConfiguration<Sprint>
{
    public void Configure(EntityTypeBuilder<Sprint> builder)
    {
        builder.ToTable("sprints");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.ProjectId).IsRequired();
        builder.Property(s => s.Name).IsRequired().HasMaxLength(120);
        builder.Property(s => s.StartDate).IsRequired();
        builder.Property(s => s.EndDate).IsRequired();
        builder.Property(s => s.ActualStartDate);
        builder.Property(s => s.VelocityTarget);
        builder.Property(s => s.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.ScopeBaselineJson).HasColumnType("jsonb");
        builder.Property(s => s.FinalVelocity);
        builder.Property(s => s.CreatedAt).IsRequired();
        builder.Property(s => s.ClosedAt);

        builder.HasIndex(s => s.ProjectId);
        // At most one active sprint per project, enforced by partial unique index.
        builder.HasIndex(s => s.ProjectId)
            .IsUnique()
            .HasFilter("\"Status\" = 'Active'")
            .HasDatabaseName("ix_sprints_one_active_per_project");

        builder.HasOne(s => s.Project)
            .WithMany(p => p.Sprints)
            .HasForeignKey(s => s.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
