using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class MilestoneConfiguration : IEntityTypeConfiguration<Milestone>
{
    public void Configure(EntityTypeBuilder<Milestone> builder)
    {
        builder.ToTable("milestones");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.ProjectId).IsRequired();
        builder.Property(m => m.Title).IsRequired().HasMaxLength(200);
        builder.Property(m => m.Date).IsRequired();
        builder.Property(m => m.Color).HasMaxLength(20);
        builder.Property(m => m.CreatedByUserId).IsRequired();
        builder.Property(m => m.CreatedAt).IsRequired();

        builder.HasIndex(m => new { m.ProjectId, m.Date });

        builder.HasOne(m => m.Project)
            .WithMany()
            .HasForeignKey(m => m.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Epic)
            .WithMany()
            .HasForeignKey(m => m.EpicId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
