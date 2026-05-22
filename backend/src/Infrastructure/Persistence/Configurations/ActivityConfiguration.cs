using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class ActivityConfiguration : IEntityTypeConfiguration<Activity>
{
    public void Configure(EntityTypeBuilder<Activity> builder)
    {
        builder.ToTable("activities");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.DealId).IsRequired();
        builder.Property(a => a.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(a => a.Summary).IsRequired().HasMaxLength(1000);
        builder.Property(a => a.OccurredAt).IsRequired();
        builder.Property(a => a.OwnerId).IsRequired();
        builder.Property(a => a.CreatedAt).IsRequired();

        builder.HasIndex(a => new { a.DealId, a.OccurredAt });
        builder.HasIndex(a => a.OwnerId);

        builder.HasOne(a => a.Deal)
            .WithMany(d => d.Activities)
            .HasForeignKey(a => a.DealId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Owner)
            .WithMany()
            .HasForeignKey(a => a.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
