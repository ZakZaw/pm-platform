using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class TaskDependencyConfiguration : IEntityTypeConfiguration<TaskDependency>
{
    public void Configure(EntityTypeBuilder<TaskDependency> builder)
    {
        builder.ToTable("task_dependencies");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.TaskId).IsRequired();
        builder.Property(d => d.DependsOnTaskId).IsRequired();
        builder.Property(d => d.CreatedAt).IsRequired();

        builder.HasIndex(d => new { d.TaskId, d.DependsOnTaskId }).IsUnique();
        // Reverse index for the unblock query (find all blocked-by edges
        // pointing at the just-completed task).
        builder.HasIndex(d => d.DependsOnTaskId);

        builder.HasOne(d => d.Task)
            .WithMany()
            .HasForeignKey(d => d.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(d => d.DependsOnTask)
            .WithMany()
            .HasForeignKey(d => d.DependsOnTaskId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
