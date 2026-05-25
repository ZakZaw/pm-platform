using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class ActivityLogConfiguration : IEntityTypeConfiguration<ActivityLog>
{
    public void Configure(EntityTypeBuilder<ActivityLog> builder)
    {
        builder.ToTable("activity_logs");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.ActorId).IsRequired();
        builder.Property(a => a.Verb).HasConversion<string>().HasMaxLength(40).IsRequired();
        builder.Property(a => a.TargetType).IsRequired().HasMaxLength(40);
        builder.Property(a => a.TargetId).IsRequired();
        builder.Property(a => a.Summary).HasMaxLength(500);
        builder.Property(a => a.MetadataJson).HasColumnType("jsonb");
        builder.Property(a => a.CreatedAt).IsRequired();

        builder.HasIndex(a => new { a.ProjectId, a.CreatedAt });
        builder.HasIndex(a => new { a.OrgId, a.CreatedAt });
        builder.HasIndex(a => new { a.TargetType, a.TargetId });

        // Personal projects have no org — Org is optional. SetNull on
        // delete so org removal doesn't cascade-wipe its activity history.
        builder.HasOne(a => a.Org)
            .WithMany()
            .HasForeignKey(a => a.OrgId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Property(a => a.OrgId).IsRequired(false);

        builder.HasOne(a => a.Project)
            .WithMany()
            .HasForeignKey(a => a.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Actor)
            .WithMany()
            .HasForeignKey(a => a.ActorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
