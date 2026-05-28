using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class MeetingTranscriptConfiguration : IEntityTypeConfiguration<MeetingTranscript>
{
    public void Configure(EntityTypeBuilder<MeetingTranscript> builder)
    {
        builder.ToTable("meeting_transcripts");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.MeetingId).IsRequired();
        // Store as JSONB so future "find every meeting where Aria
        // spoke" queries are cheap. Default text is a literal "[]" so
        // EF can read the column even before the first segment lands.
        builder.Property(t => t.SegmentsJson)
            .HasColumnType("jsonb")
            .IsRequired()
            .HasDefaultValueSql("'[]'::jsonb");
        builder.Property(t => t.StartedAt);
        builder.Property(t => t.LastSegmentAt);
        builder.Property(t => t.FinalisedAt);

        // One transcript per meeting — the segment-append command does
        // an upsert keyed on this.
        builder.HasIndex(t => t.MeetingId).IsUnique();

        builder.HasOne(t => t.Meeting)
            .WithMany()
            .HasForeignKey(t => t.MeetingId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
