using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class RoadmapShareLinkConfiguration : IEntityTypeConfiguration<RoadmapShareLink>
{
    public void Configure(EntityTypeBuilder<RoadmapShareLink> builder)
    {
        builder.ToTable("roadmap_share_links");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.ProjectId).IsRequired();
        builder.Property(l => l.Token).IsRequired().HasMaxLength(64);
        builder.Property(l => l.PasswordHash).HasMaxLength(200);
        builder.Property(l => l.HideInternalLabels).IsRequired();
        builder.Property(l => l.HideAssignees).IsRequired();
        builder.Property(l => l.CreatedByUserId).IsRequired();
        builder.Property(l => l.CreatedAt).IsRequired();

        builder.HasIndex(l => l.Token).IsUnique();
        builder.HasIndex(l => new { l.ProjectId, l.RevokedAt });

        builder.HasOne(l => l.Project)
            .WithMany()
            .HasForeignKey(l => l.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(l => l.CreatedBy)
            .WithMany()
            .HasForeignKey(l => l.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
