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

        builder.Property(t => t.StoryId).IsRequired();
        builder.Property(t => t.Title).IsRequired().HasMaxLength(200);
        builder.Property(t => t.Description);
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.Priority).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.TimeLoggedMinutes).IsRequired();
        builder.Property(t => t.PrUrl).HasMaxLength(512);
        builder.Property(t => t.CreatedByAi).IsRequired();
        builder.Property(t => t.CreatedAt).IsRequired();

        builder.HasIndex(t => t.StoryId);
        builder.HasIndex(t => t.AssigneeId);

        builder.HasOne(t => t.Story)
            .WithMany(s => s.Tasks)
            .HasForeignKey(t => t.StoryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.Assignee)
            .WithMany()
            .HasForeignKey(t => t.AssigneeId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.Reviewer)
            .WithMany()
            .HasForeignKey(t => t.ReviewerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
