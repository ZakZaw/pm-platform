using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class SubtaskConfiguration : IEntityTypeConfiguration<Subtask>
{
    public void Configure(EntityTypeBuilder<Subtask> builder)
    {
        builder.ToTable("subtasks");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.TaskId).IsRequired();
        builder.Property(s => s.Title).IsRequired().HasMaxLength(200);
        builder.Property(s => s.Completed).IsRequired();
        builder.Property(s => s.Order).IsRequired();
        builder.Property(s => s.CreatedAt).IsRequired();

        builder.HasIndex(s => s.TaskId);

        builder.HasOne(s => s.Task)
            .WithMany(t => t.Subtasks)
            .HasForeignKey(s => s.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Assignee)
            .WithMany()
            .HasForeignKey(s => s.AssigneeId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
