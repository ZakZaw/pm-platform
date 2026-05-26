using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class TimeLogConfiguration : IEntityTypeConfiguration<TimeLog>
{
    public void Configure(EntityTypeBuilder<TimeLog> builder)
    {
        builder.ToTable("time_logs");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.TaskId).IsRequired();
        builder.Property(t => t.UserId).IsRequired();
        builder.Property(t => t.Minutes).IsRequired();
        builder.Property(t => t.LoggedAt).IsRequired();
        builder.Property(t => t.Comment).HasMaxLength(500);
        builder.Property(t => t.CreatedAt).IsRequired();

        builder.HasIndex(t => t.TaskId);
        builder.HasIndex(t => new { t.UserId, t.LoggedAt });

        builder.HasOne(t => t.Task)
            .WithMany()
            .HasForeignKey(t => t.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.User)
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
