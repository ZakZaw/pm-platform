using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class LeadConfiguration : IEntityTypeConfiguration<Lead>
{
    public void Configure(EntityTypeBuilder<Lead> builder)
    {
        builder.ToTable("leads");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.ProjectId).IsRequired();
        builder.Property(l => l.AccountId);
        builder.Property(l => l.Name).IsRequired().HasMaxLength(200);
        builder.Property(l => l.Email).HasMaxLength(200);
        builder.Property(l => l.Phone).HasMaxLength(40);
        builder.Property(l => l.Source).HasMaxLength(80);
        builder.Property(l => l.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(l => l.OwnerId);
        builder.Property(l => l.ConvertedDealId);
        builder.Property(l => l.CreatedAt).IsRequired();
        builder.Property(l => l.ConvertedAt);

        builder.HasIndex(l => new { l.ProjectId, l.Status });
        builder.HasIndex(l => l.AccountId);
        builder.HasIndex(l => l.OwnerId);

        builder.HasOne(l => l.Project)
            .WithMany()
            .HasForeignKey(l => l.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(l => l.Account)
            .WithMany(a => a.Leads)
            .HasForeignKey(l => l.AccountId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(l => l.Owner)
            .WithMany()
            .HasForeignKey(l => l.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(l => l.ConvertedDeal)
            .WithMany()
            .HasForeignKey(l => l.ConvertedDealId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
