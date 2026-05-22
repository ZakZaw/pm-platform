using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("accounts");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.ProjectId).IsRequired();
        builder.Property(a => a.Name).IsRequired().HasMaxLength(200);
        builder.Property(a => a.Domain).HasMaxLength(200);
        builder.Property(a => a.Industry).HasMaxLength(80);
        builder.Property(a => a.Notes);
        builder.Property(a => a.OwnerId);
        builder.Property(a => a.CreatedAt).IsRequired();
        builder.Property(a => a.ArchivedAt);

        builder.HasIndex(a => new { a.ProjectId, a.ArchivedAt });
        builder.HasIndex(a => a.OwnerId);

        builder.HasOne(a => a.Project)
            .WithMany()
            .HasForeignKey(a => a.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Owner)
            .WithMany()
            .HasForeignKey(a => a.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
