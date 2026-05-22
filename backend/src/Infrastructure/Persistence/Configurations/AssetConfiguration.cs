using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class AssetConfiguration : IEntityTypeConfiguration<Asset>
{
    public void Configure(EntityTypeBuilder<Asset> builder)
    {
        builder.ToTable("assets");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.CampaignId).IsRequired();
        builder.Property(a => a.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(a => a.Title).IsRequired().HasMaxLength(200);
        builder.Property(a => a.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(a => a.PublishDate);
        builder.Property(a => a.OwnerId);
        builder.Property(a => a.FileUrl).HasMaxLength(1000);
        builder.Property(a => a.BodyMd);
        builder.Property(a => a.RejectionReason).HasMaxLength(1000);
        builder.Property(a => a.CreatedAt).IsRequired();
        builder.Property(a => a.UpdatedAt);

        builder.HasIndex(a => new { a.CampaignId, a.Status });
        builder.HasIndex(a => a.PublishDate);
        builder.HasIndex(a => a.OwnerId);

        builder.HasOne(a => a.Campaign)
            .WithMany(c => c.Assets)
            .HasForeignKey(a => a.CampaignId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Owner)
            .WithMany()
            .HasForeignKey(a => a.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
