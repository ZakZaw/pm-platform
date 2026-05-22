using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class CampaignConfiguration : IEntityTypeConfiguration<Campaign>
{
    public void Configure(EntityTypeBuilder<Campaign> builder)
    {
        builder.ToTable("campaigns");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.ProjectId).IsRequired();
        builder.Property(c => c.Name).IsRequired().HasMaxLength(200);
        builder.Property(c => c.Channel).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(c => c.StartDate);
        builder.Property(c => c.EndDate);
        builder.Property(c => c.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(c => c.GoalMd);
        builder.Property(c => c.BudgetAmount).HasPrecision(18, 2);
        builder.Property(c => c.BudgetCurrency).HasMaxLength(3);
        builder.Property(c => c.OwnerId);
        builder.Property(c => c.CreatedAt).IsRequired();
        builder.Property(c => c.ArchivedAt);

        builder.HasIndex(c => new { c.ProjectId, c.Status });
        builder.HasIndex(c => new { c.ProjectId, c.Channel });
        builder.HasIndex(c => c.OwnerId);

        builder.HasOne(c => c.Project)
            .WithMany()
            .HasForeignKey(c => c.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Owner)
            .WithMany()
            .HasForeignKey(c => c.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
