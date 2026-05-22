using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class TicketConfiguration : IEntityTypeConfiguration<Ticket>
{
    public void Configure(EntityTypeBuilder<Ticket> builder)
    {
        builder.ToTable("tickets");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.ProjectId).IsRequired();
        builder.Property(t => t.CustomerId).IsRequired();
        builder.Property(t => t.QueueId).IsRequired();
        builder.Property(t => t.Subject).IsRequired().HasMaxLength(300);
        builder.Property(t => t.BodyMd);
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(t => t.Priority).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(t => t.AssigneeId);
        builder.Property(t => t.OpenedAt).IsRequired();
        builder.Property(t => t.SlaDueAt).IsRequired();
        builder.Property(t => t.FirstResponseAt);
        builder.Property(t => t.ResolvedAt);
        builder.Property(t => t.ClosedAt);
        builder.Property(t => t.SlaBreachNotified).IsRequired();

        builder.HasIndex(t => new { t.ProjectId, t.Status });
        builder.HasIndex(t => new { t.QueueId, t.Status });
        builder.HasIndex(t => t.CustomerId);
        builder.HasIndex(t => t.AssigneeId);
        builder.HasIndex(t => t.SlaDueAt);

        builder.HasOne(t => t.Project)
            .WithMany()
            .HasForeignKey(t => t.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.Customer)
            .WithMany(c => c.Tickets)
            .HasForeignKey(t => t.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(t => t.Queue)
            .WithMany(q => q.Tickets)
            .HasForeignKey(t => t.QueueId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(t => t.Assignee)
            .WithMany()
            .HasForeignKey(t => t.AssigneeId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
