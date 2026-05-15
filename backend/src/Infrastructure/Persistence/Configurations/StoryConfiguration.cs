using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class StoryConfiguration : IEntityTypeConfiguration<Story>
{
    public void Configure(EntityTypeBuilder<Story> builder)
    {
        builder.ToTable("stories");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.ProjectId).IsRequired();
        builder.Property(s => s.Title).IsRequired().HasMaxLength(200);
        builder.Property(s => s.Description);
        builder.Property(s => s.StoryPoints);
        builder.Property(s => s.Priority).HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.PriorityOrder).IsRequired();
        builder.Property(s => s.AcceptanceCriteria)
            .HasColumnType("text[]")
            .HasDefaultValueSql("ARRAY[]::text[]");
        builder.Property(s => s.CreatedByAi).IsRequired();
        builder.Property(s => s.CreatedAt).IsRequired();

        builder.HasIndex(s => new { s.ProjectId, s.Status });
        builder.HasIndex(s => s.EpicId);

        builder.HasOne(s => s.Project)
            .WithMany()
            .HasForeignKey(s => s.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Epic)
            .WithMany(e => e.Stories)
            .HasForeignKey(s => s.EpicId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(s => s.Assignee)
            .WithMany()
            .HasForeignKey(s => s.AssigneeId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(s => s.Reporter)
            .WithMany()
            .HasForeignKey(s => s.ReporterId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
