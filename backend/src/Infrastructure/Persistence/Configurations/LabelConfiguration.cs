using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class LabelConfiguration : IEntityTypeConfiguration<Label>
{
    public void Configure(EntityTypeBuilder<Label> builder)
    {
        builder.ToTable("labels");
        builder.HasKey(l => l.Id);

        builder.Property(l => l.ProjectId).IsRequired();
        builder.Property(l => l.Name).IsRequired().HasMaxLength(60);
        builder.Property(l => l.Color).IsRequired().HasMaxLength(20);
        builder.Property(l => l.CreatedAt).IsRequired();

        builder.HasIndex(l => new { l.ProjectId, l.Name }).IsUnique();

        builder.HasOne(l => l.Project)
            .WithMany()
            .HasForeignKey(l => l.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class TaskLabelConfiguration : IEntityTypeConfiguration<TaskLabel>
{
    public void Configure(EntityTypeBuilder<TaskLabel> builder)
    {
        builder.ToTable("task_labels");
        builder.HasKey(tl => new { tl.TaskId, tl.LabelId });

        builder.HasOne(tl => tl.Task)
            .WithMany()
            .HasForeignKey(tl => tl.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(tl => tl.Label)
            .WithMany(l => l.TaskLinks)
            .HasForeignKey(tl => tl.LabelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(tl => tl.LabelId);
    }
}
