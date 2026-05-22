using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class MarketingTaskConfiguration : IEntityTypeConfiguration<MarketingTask>
{
    public void Configure(EntityTypeBuilder<MarketingTask> builder)
    {
        builder.ToTable("marketing_tasks");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.CampaignId).IsRequired();
        builder.Property(t => t.AssetId);
        builder.Property(t => t.Title).IsRequired().HasMaxLength(200);
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(t => t.AssigneeId);
        builder.Property(t => t.DueDate);
        builder.Property(t => t.CreatedAt).IsRequired();

        builder.HasIndex(t => new { t.CampaignId, t.Status });
        builder.HasIndex(t => t.AssetId);
        builder.HasIndex(t => t.AssigneeId);
        builder.HasIndex(t => t.DueDate);

        builder.HasOne(t => t.Campaign)
            .WithMany(c => c.Tasks)
            .HasForeignKey(t => t.CampaignId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.Asset)
            .WithMany(a => a.Tasks)
            .HasForeignKey(t => t.AssetId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.Assignee)
            .WithMany()
            .HasForeignKey(t => t.AssigneeId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
