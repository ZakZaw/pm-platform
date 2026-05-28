using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

/// <summary>
/// F2-23 — GitHub (and future source-control) integration per project.
/// One repo maps to one project: the unique index on
/// (Provider, RepoFullName) keeps webhook routing unambiguous.
/// </summary>
public class IntegrationConfiguration : IEntityTypeConfiguration<Integration>
{
    public void Configure(EntityTypeBuilder<Integration> builder)
    {
        builder.ToTable("integrations");
        builder.HasKey(i => i.Id);

        builder.Property(i => i.ProjectId).IsRequired();
        builder.Property(i => i.Provider)
            .HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(i => i.RepoFullName).IsRequired().HasMaxLength(300);
        builder.Property(i => i.AccessToken).HasMaxLength(500);
        builder.Property(i => i.WebhookSecret).IsRequired().HasMaxLength(100);
        builder.Property(i => i.WebhookId);
        builder.Property(i => i.ConnectedByUserId).IsRequired();
        builder.Property(i => i.CreatedAt).IsRequired();
        builder.Property(i => i.LastEventAt);

        // One project per repo — keeps inbound webhook routing 1:1.
        builder.HasIndex(i => new { i.Provider, i.RepoFullName }).IsUnique();
        builder.HasIndex(i => i.ProjectId);

        builder.HasOne(i => i.Project)
            .WithMany()
            .HasForeignKey(i => i.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(i => i.ConnectedBy)
            .WithMany()
            .HasForeignKey(i => i.ConnectedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
