using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class WorkflowRunConfiguration : IEntityTypeConfiguration<WorkflowRun>
{
    public void Configure(EntityTypeBuilder<WorkflowRun> builder)
    {
        builder.ToTable("workflow_runs");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.WorkflowId).IsRequired();
        builder.Property(r => r.ScheduledFor).IsRequired();
        builder.Property(r => r.StartedAt);
        builder.Property(r => r.CompletedAt);
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(r => r.SkippedReason).HasMaxLength(1000);
        builder.Property(r => r.OwnerId);
        builder.Property(r => r.CreatedAt).IsRequired();

        builder.HasIndex(r => new { r.WorkflowId, r.ScheduledFor });
        builder.HasIndex(r => new { r.Status, r.ScheduledFor });
        builder.HasIndex(r => r.OwnerId);

        builder.HasOne(r => r.Workflow)
            .WithMany(w => w.Runs)
            .HasForeignKey(r => r.WorkflowId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.Owner)
            .WithMany()
            .HasForeignKey(r => r.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
