using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class QueueConfiguration : IEntityTypeConfiguration<Queue>
{
    public void Configure(EntityTypeBuilder<Queue> builder)
    {
        builder.ToTable("queues");
        builder.HasKey(q => q.Id);

        builder.Property(q => q.ProjectId).IsRequired();
        builder.Property(q => q.Name).IsRequired().HasMaxLength(60);
        builder.Property(q => q.Order).IsRequired();
        builder.Property(q => q.SlaMinutes).IsRequired();
        builder.Property(q => q.DefaultAssigneeId);
        builder.Property(q => q.CreatedAt).IsRequired();

        builder.HasIndex(q => new { q.ProjectId, q.Order });

        builder.HasOne(q => q.Project)
            .WithMany()
            .HasForeignKey(q => q.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(q => q.DefaultAssignee)
            .WithMany()
            .HasForeignKey(q => q.DefaultAssigneeId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
