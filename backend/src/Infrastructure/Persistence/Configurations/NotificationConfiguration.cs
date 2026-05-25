using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("notifications");

        builder.HasKey(n => n.Id);

        builder.Property(n => n.UserId).IsRequired();
        builder.Property(n => n.OrgId).IsRequired();
        builder.Property(n => n.Kind).HasConversion<string>().HasMaxLength(40).IsRequired();
        builder.Property(n => n.Title).IsRequired().HasMaxLength(200);
        builder.Property(n => n.BodyMd).HasMaxLength(2000);
        builder.Property(n => n.LinkUrl).HasMaxLength(500);
        builder.Property(n => n.TargetType).HasMaxLength(40);
        builder.Property(n => n.CreatedAt).IsRequired();

        // Inbox listing query: user's notifications newest-first, with an
        // unread filter as a hot path.
        builder.HasIndex(n => new { n.UserId, n.CreatedAt });
        builder.HasIndex(n => new { n.UserId, n.ReadAt });

        builder.HasOne(n => n.User)
            .WithMany()
            .HasForeignKey(n => n.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(n => n.Org)
            .WithMany()
            .HasForeignKey(n => n.OrgId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(n => n.Project)
            .WithMany()
            .HasForeignKey(n => n.ProjectId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(n => n.Actor)
            .WithMany()
            .HasForeignKey(n => n.ActorId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
