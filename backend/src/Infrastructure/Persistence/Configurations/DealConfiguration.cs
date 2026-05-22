using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class DealConfiguration : IEntityTypeConfiguration<Deal>
{
    public void Configure(EntityTypeBuilder<Deal> builder)
    {
        builder.ToTable("deals");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.ProjectId).IsRequired();
        builder.Property(d => d.AccountId).IsRequired();
        builder.Property(d => d.Name).IsRequired().HasMaxLength(200);
        builder.Property(d => d.Value).HasPrecision(18, 2).IsRequired();
        builder.Property(d => d.Currency).IsRequired().HasMaxLength(3);
        builder.Property(d => d.StageId).IsRequired();
        builder.Property(d => d.Probability).IsRequired();
        builder.Property(d => d.ExpectedClose);
        builder.Property(d => d.OwnerId);
        builder.Property(d => d.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(d => d.LostReason).HasMaxLength(500);
        builder.Property(d => d.WonNote).HasMaxLength(500);
        builder.Property(d => d.CreatedAt).IsRequired();
        builder.Property(d => d.ClosedAt);

        builder.HasIndex(d => new { d.ProjectId, d.StageId });
        builder.HasIndex(d => new { d.ProjectId, d.Status });
        builder.HasIndex(d => d.AccountId);
        builder.HasIndex(d => d.OwnerId);

        builder.HasOne(d => d.Project)
            .WithMany()
            .HasForeignKey(d => d.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(d => d.Account)
            .WithMany(a => a.Deals)
            .HasForeignKey(d => d.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(d => d.Stage)
            .WithMany(s => s.Deals)
            .HasForeignKey(d => d.StageId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(d => d.Owner)
            .WithMany()
            .HasForeignKey(d => d.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
