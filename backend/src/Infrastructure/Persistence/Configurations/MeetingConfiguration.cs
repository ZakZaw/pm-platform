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
