using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class TaskStatusChangeConfiguration : IEntityTypeConfiguration<TaskStatusChange>
{
    public void Configure(EntityTypeBuilder<TaskStatusChange> builder)
    {
        builder.ToTable("task_status_changes");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.TaskId).IsRequired();
        builder.Property(c => c.FromStatus).HasConversion<string>().HasMaxLength(20);
        builder.Property(c => c.ToStatus).HasConversion<string>().HasMaxLength(20);
        builder.Property(c => c.ByUserId).IsRequired();
        builder.Property(c => c.Reason).HasMaxLength(500);
        builder.Property(c => c.CreatedAt).IsRequired();

        builder.HasIndex(c => c.TaskId);

        builder.HasOne(c => c.Task)
            .WithMany(t => t.StatusHistory)
            .HasForeignKey(c => c.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.ByUser)
            .WithMany()
            .HasForeignKey(c => c.ByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
