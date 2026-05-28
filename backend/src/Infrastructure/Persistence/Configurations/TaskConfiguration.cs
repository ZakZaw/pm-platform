using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskEntity = Domain.Entities.Task;

namespace Infrastructure.Persistence.Configurations;

public class TaskConfiguration : IEntityTypeConfiguration<TaskEntity>
{
    public void Configure(EntityTypeBuilder<TaskEntity> builder)
    {
        builder.ToTable("tasks");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.ProjectId).IsRequired();
        builder.Property(t => t.KeyNum).IsRequired();
        builder.Property(t => t.Title).IsRequired().HasMaxLength(200);
        builder.Property(t => t.Description);
        builder.Property(t => t.StoryPoints);
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.Priority).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.PriorityOrder).IsRequired();
        builder.Property(t => t.AcceptanceCriteria)
            .HasColumnType("text[]")
            .HasDefaultValueSql("ARRAY[]::text[]");
        builder.Property(t => t.TimeLoggedMinutes).IsRequired();
        builder.Property(t => t.PrUrl).HasMaxLength(512);
        // F2-23 — GitHub PR / CI metadata for the linked pull request.
        builder.Property(t => t.PrNumber);
        builder.Property(t => t.PrState).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.CiStatus).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.CiUrl).HasMaxLength(1000);
        builder.Property(t => t.CreatedByAi).IsRequired();
        // F2-22 — source meeting for tasks accepted from action-item drafts.
        builder.Property(t => t.SourceMeetingId);
        builder.Property(t => t.CreatedAt).IsRequired();

        builder.HasIndex(t => new { t.ProjectId, t.Status });
        builder.HasIndex(t => new { t.ProjectId, t.KeyNum }).IsUnique();
        builder.HasIndex(t => t.EpicId);
        builder.HasIndex(t => t.SprintId);
        builder.HasIndex(t => t.AssigneeId);
        builder.HasIndex(t => t.TaskListId);

        builder.HasOne(t => t.Project)
            .WithMany(p => p.Tasks)
            .HasForeignKey(t => t.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.Epic)
            .WithMany(e => e.Tasks)
            .HasForeignKey(t => t.EpicId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.Sprint)
            .WithMany(s => s.Tasks)
            .HasForeignKey(t => t.SprintId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.TaskList)
            .WithMany(l => l.Tasks)
            .HasForeignKey(t => t.TaskListId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.Assignee)
            .WithMany()
            .HasForeignKey(t => t.AssigneeId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.Reviewer)
            .WithMany()
            .HasForeignKey(t => t.ReviewerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.Reporter)
            .WithMany()
            .HasForeignKey(t => t.ReporterId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
