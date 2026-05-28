using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class MeetingConfiguration : IEntityTypeConfiguration<Meeting>
{
    public void Configure(EntityTypeBuilder<Meeting> builder)
    {
        builder.ToTable("meetings");
        builder.HasKey(m => m.Id);

        builder.Property(m => m.SeriesId).IsRequired();
        builder.Property(m => m.ProjectId).IsRequired();
        builder.Property(m => m.OrganizerId).IsRequired();
        builder.Property(m => m.Title).IsRequired().HasMaxLength(200);
        builder.Property(m => m.Description).HasMaxLength(2000);
        builder.Property(m => m.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(m => m.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(m => m.ScheduledAt).IsRequired();
        builder.Property(m => m.DurationMinutes).IsRequired();
        builder.Property(m => m.RecurrenceRule).HasMaxLength(400);
        builder.Property(m => m.AgendaMd);
        builder.Property(m => m.AgendaFromAi).IsRequired();
        builder.Property(m => m.CreatedAt).IsRequired();
        builder.Property(m => m.UpdatedAt).IsRequired();

        // F2-20 live-room columns.
        builder.Property(m => m.ActiveParticipantCount).IsRequired();
        builder.Property(m => m.RecordingEgressId).HasMaxLength(80);
        builder.Property(m => m.RecordingStartedAt);
        builder.Property(m => m.RecordingStoppedAt);
        builder.Property(m => m.RecordingUrl).HasMaxLength(1000);

        // F2-22 AI post-meeting processing outputs.
        builder.Property(m => m.SummaryMd);
        builder.Property(m => m.DecisionsJson).HasColumnType("jsonb");
        builder.Property(m => m.OpenQuestionsJson).HasColumnType("jsonb");
        builder.Property(m => m.BlockersJson).HasColumnType("jsonb");
        builder.Property(m => m.ProcessedAt);

        // Per-project chronological feed and series lookup.
        builder.HasIndex(m => new { m.ProjectId, m.ScheduledAt });
        builder.HasIndex(m => m.SeriesId);

        builder.HasOne(m => m.Project)
            .WithMany()
            .HasForeignKey(m => m.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Organizer)
            .WithMany()
            .HasForeignKey(m => m.OrganizerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class MeetingActionItemConfiguration : IEntityTypeConfiguration<MeetingActionItem>
{
    public void Configure(EntityTypeBuilder<MeetingActionItem> builder)
    {
        builder.ToTable("meeting_action_items");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.MeetingId).IsRequired();
        builder.Property(a => a.Title).IsRequired().HasMaxLength(300);
        builder.Property(a => a.Description).HasMaxLength(2000);
        builder.Property(a => a.SuggestedOwnerUserId);
        builder.Property(a => a.SuggestedDueDate);
        builder.Property(a => a.SuggestedPriority)
            .HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(a => a.AcceptedAt);
        builder.Property(a => a.AcceptedTaskId);
        builder.Property(a => a.AcceptedByUserId);
        builder.Property(a => a.DismissedAt);
        builder.Property(a => a.DismissedByUserId);
        builder.Property(a => a.OrderIndex).IsRequired();
        builder.Property(a => a.CreatedAt).IsRequired();

        builder.HasIndex(a => new { a.MeetingId, a.OrderIndex });

        builder.HasOne(a => a.Meeting)
            .WithMany(m => m.ActionItems)
            .HasForeignKey(a => a.MeetingId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.SuggestedOwner)
            .WithMany()
            .HasForeignKey(a => a.SuggestedOwnerUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class MeetingGuestLinkConfiguration : IEntityTypeConfiguration<MeetingGuestLink>
{
    public void Configure(EntityTypeBuilder<MeetingGuestLink> builder)
    {
        builder.ToTable("meeting_guest_links");
        builder.HasKey(g => g.Id);

        builder.Property(g => g.MeetingId).IsRequired();
        builder.Property(g => g.CreatedByUserId).IsRequired();
        builder.Property(g => g.Token).IsRequired().HasMaxLength(64);
        builder.Property(g => g.GuestLabel).HasMaxLength(80);
        builder.Property(g => g.CreatedAt).IsRequired();
        builder.Property(g => g.ExpiresAt).IsRequired();
        builder.Property(g => g.RevokedAt);

        // Public-route lookup goes through the token, never the id.
        builder.HasIndex(g => g.Token).IsUnique();
        builder.HasIndex(g => g.MeetingId);

        builder.HasOne(g => g.Meeting)
            .WithMany(m => m.GuestLinks)
            .HasForeignKey(g => g.MeetingId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class MeetingAttendeeConfiguration : IEntityTypeConfiguration<MeetingAttendee>
{
    public void Configure(EntityTypeBuilder<MeetingAttendee> builder)
    {
        builder.ToTable("meeting_attendees");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.MeetingId).IsRequired();
        builder.Property(a => a.UserId).IsRequired();
        builder.Property(a => a.Response).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(a => a.InvitedAt).IsRequired();
        builder.Property(a => a.RespondedAt);
        builder.Property(a => a.Required).IsRequired();

        // One attendee row per (meeting, user). UserId index so the
        // "my meetings" query stays cheap.
        builder.HasIndex(a => new { a.MeetingId, a.UserId }).IsUnique();
        builder.HasIndex(a => a.UserId);

        builder.HasOne(a => a.Meeting)
            .WithMany(m => m.Attendees)
            .HasForeignKey(a => a.MeetingId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.User)
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
