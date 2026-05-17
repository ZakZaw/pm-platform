using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class EpicConfiguration : IEntityTypeConfiguration<Epic>
{
    public void Configure(EntityTypeBuilder<Epic> builder)
    {
        builder.ToTable("epics");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.ProjectId).IsRequired();
        builder.Property(e => e.Title).IsRequired().HasMaxLength(200);
        builder.Property(e => e.Description);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.EnvironmentType).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.Color).HasMaxLength(20);
        builder.Property(e => e.CreatedByAi).IsRequired();
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.ArchivedAt);

        builder.HasIndex(e => e.ProjectId);

        builder.HasOne(e => e.Project)
            .WithMany(p => p.Epics)
            .HasForeignKey(e => e.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Owner)
            .WithMany()
            .HasForeignKey(e => e.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
