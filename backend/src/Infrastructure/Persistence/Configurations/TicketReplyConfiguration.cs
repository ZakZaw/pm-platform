using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class TicketReplyConfiguration : IEntityTypeConfiguration<TicketReply>
{
    public void Configure(EntityTypeBuilder<TicketReply> builder)
    {
        builder.ToTable("ticket_replies");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.TicketId).IsRequired();
        builder.Property(r => r.AuthorId).IsRequired();
        builder.Property(r => r.BodyMd).IsRequired();
        builder.Property(r => r.IsInternal).IsRequired();
        builder.Property(r => r.CreatedAt).IsRequired();
        builder.Property(r => r.EditedAt);

        builder.HasIndex(r => new { r.TicketId, r.CreatedAt });

        builder.HasOne(r => r.Ticket)
            .WithMany(t => t.Replies)
            .HasForeignKey(r => r.TicketId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.Author)
            .WithMany()
            .HasForeignKey(r => r.AuthorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
