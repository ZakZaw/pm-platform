using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class WorkflowConfiguration : IEntityTypeConfiguration<Workflow>
{
    public void Configure(EntityTypeBuilder<Workflow> builder)
    {
        builder.ToTable("workflows");
        builder.HasKey(w => w.Id);

        builder.Property(w => w.ProjectId).IsRequired();
        builder.Property(w => w.Name).IsRequired().HasMaxLength(200);
        builder.Property(w => w.Description);
        builder.Property(w => w.RecurrenceRule).HasMaxLength(200);
        builder.Property(w => w.OwnerId);
        builder.Property(w => w.TemplateJson).IsRequired().HasColumnType("jsonb");
        builder.Property(w => w.CreatedAt).IsRequired();
        builder.Property(w => w.ArchivedAt);

        builder.HasIndex(w => new { w.ProjectId, w.ArchivedAt });
        builder.HasIndex(w => w.OwnerId);

        builder.HasOne(w => w.Project)
            .WithMany()
            .HasForeignKey(w => w.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(w => w.Owner)
            .WithMany()
            .HasForeignKey(w => w.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
