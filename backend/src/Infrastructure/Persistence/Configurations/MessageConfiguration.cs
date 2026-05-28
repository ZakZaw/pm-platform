using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class MessageConfiguration : IEntityTypeConfiguration<Message>
{
    public void Configure(EntityTypeBuilder<Message> builder)
    {
        builder.ToTable("messages");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.ChannelId).IsRequired();
        builder.Property(m => m.AuthorId).IsRequired();
        builder.Property(m => m.BodyMd).IsRequired();
        builder.Property(m => m.CreatedAt).IsRequired();
        builder.Property(m => m.EditedAt);
        builder.Property(m => m.DeletedAt);
        builder.Property(m => m.ParentMessageId);

        // Channel feed lookup: ordered most-recent-first, filtered by
        // parent IS NULL for the top-level pane.
        builder.HasIndex(m => new { m.ChannelId, m.CreatedAt });

        // Thread loading: every reply under a parent in order.
        builder.HasIndex(m => new { m.ParentMessageId, m.CreatedAt })
            .HasFilter("\"ParentMessageId\" IS NOT NULL");

        builder.HasOne(m => m.Channel)
            .WithMany()
            .HasForeignKey(m => m.ChannelId)
            .OnDelete(DeleteBehavior.Cascade);

        // Parent->replies. SetNull on delete so a deleted parent
        // doesn't take its replies with it — soft-deletes use
        // DeletedAt anyway.
        builder.HasOne(m => m.Parent)
            .WithMany()
            .HasForeignKey(m => m.ParentMessageId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(m => m.Author)
            .WithMany()
            .HasForeignKey(m => m.AuthorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class MessageReactionConfiguration : IEntityTypeConfiguration<MessageReaction>
{
    public void Configure(EntityTypeBuilder<MessageReaction> builder)
    {
        builder.ToTable("message_reactions");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.MessageId).IsRequired();
        builder.Property(r => r.UserId).IsRequired();
        builder.Property(r => r.Emoji).IsRequired().HasMaxLength(60);
        builder.Property(r => r.CreatedAt).IsRequired();

        // Toggle semantics rely on this triple being unique.
        builder.HasIndex(r => new { r.MessageId, r.UserId, r.Emoji }).IsUnique();
        builder.HasIndex(r => r.MessageId);

        builder.HasOne(r => r.Message)
            .WithMany(m => m.Reactions)
            .HasForeignKey(r => r.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
