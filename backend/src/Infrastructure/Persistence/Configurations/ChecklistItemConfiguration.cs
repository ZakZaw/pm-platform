using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class ChecklistItemConfiguration : IEntityTypeConfiguration<ChecklistItem>
{
    public void Configure(EntityTypeBuilder<ChecklistItem> builder)
    {
        builder.ToTable("checklist_items");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.RunId).IsRequired();
        builder.Property(c => c.Title).IsRequired().HasMaxLength(300);
        builder.Property(c => c.Completed).IsRequired();
        builder.Property(c => c.CompletedBy);
        builder.Property(c => c.CompletedAt);
        builder.Property(c => c.Order).IsRequired();
        builder.Property(c => c.Sequential).IsRequired();

        builder.HasIndex(c => new { c.RunId, c.Order });

        builder.HasOne(c => c.Run)
            .WithMany(r => r.Items)
            .HasForeignKey(c => c.RunId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
