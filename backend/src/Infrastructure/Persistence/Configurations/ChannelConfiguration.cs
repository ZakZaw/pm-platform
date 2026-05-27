using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class ChannelConfiguration : IEntityTypeConfiguration<Channel>
{
    public void Configure(EntityTypeBuilder<Channel> builder)
    {
        builder.ToTable("channels");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.OrganizationId).IsRequired();
        builder.Property(c => c.Name).IsRequired().HasMaxLength(120);
        builder.Property(c => c.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(c => c.LastActivityAt).IsRequired();
        builder.Property(c => c.CreatedAt).IsRequired();
        builder.Property(c => c.ArchivedAt);

        // Org-Wide channel: filtered unique to enforce one-per-org.
        builder.HasIndex(c => c.OrganizationId)
            .IsUnique()
            .HasFilter("\"Type\" = 'OrgWide' AND \"ArchivedAt\" IS NULL")
            .HasDatabaseName("ix_channels_org_orgwide_unique");

        // Project + Team channels: at most one open channel per scope.
        builder.HasIndex(c => c.ProjectId)
            .IsUnique()
            .HasFilter("\"ProjectId\" IS NOT NULL AND \"Type\" = 'Project' AND \"ArchivedAt\" IS NULL")
            .HasDatabaseName("ix_channels_project_unique");

        builder.HasIndex(c => c.TeamId)
            .IsUnique()
            .HasFilter("\"TeamId\" IS NOT NULL AND \"Type\" = 'Team' AND \"ArchivedAt\" IS NULL")
            .HasDatabaseName("ix_channels_team_unique");

        builder.HasIndex(c => new { c.OrganizationId, c.Type, c.LastActivityAt });

        builder.HasOne(c => c.Organization)
            .WithMany()
            .HasForeignKey(c => c.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Project)
            .WithMany()
            .HasForeignKey(c => c.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // No HasOne for Team: the Team entity is EF-ignored until the
        // team-management feature lands. TeamId stays as a raw Guid?
        // so team channels can be materialised later without a schema
        // change.
        builder.Property(c => c.TeamId);

        builder.HasOne(c => c.Epic)
            .WithMany()
            .HasForeignKey(c => c.EpicId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class ChannelMemberConfiguration : IEntityTypeConfiguration<ChannelMember>
{
    public void Configure(EntityTypeBuilder<ChannelMember> builder)
    {
        builder.ToTable("channel_members");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.ChannelId).IsRequired();
        builder.Property(m => m.UserId).IsRequired();
        builder.Property(m => m.JoinedAt).IsRequired();
        builder.Property(m => m.LastReadAt);

        // One row per (channel, user). Indexed in both directions so
        // the "user's channels" sidebar and the "channel's members"
        // panel both run on a single seek.
        builder.HasIndex(m => new { m.ChannelId, m.UserId }).IsUnique();
        builder.HasIndex(m => m.UserId);

        builder.HasOne(m => m.Channel)
            .WithMany(c => c.Members)
            .HasForeignKey(m => m.ChannelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.User)
            .WithMany()
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
