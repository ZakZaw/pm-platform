using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class PokerSessionConfiguration : IEntityTypeConfiguration<PokerSession>
{
    public void Configure(EntityTypeBuilder<PokerSession> builder)
    {
        builder.ToTable("poker_sessions");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.TaskId).IsRequired();
        builder.Property(s => s.ProjectId).IsRequired();
        builder.Property(s => s.HostUserId).IsRequired();
        builder.Property(s => s.Status).HasConversion<string>().IsRequired();
        builder.Property(s => s.CreatedAt).IsRequired();

        builder.HasIndex(s => new { s.ProjectId, s.Status });
        builder.HasIndex(s => s.TaskId);

        builder.HasOne(s => s.Task)
            .WithMany()
            .HasForeignKey(s => s.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Project)
            .WithMany()
            .HasForeignKey(s => s.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Host)
            .WithMany()
            .HasForeignKey(s => s.HostUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PokerVoteConfiguration : IEntityTypeConfiguration<PokerVote>
{
    public void Configure(EntityTypeBuilder<PokerVote> builder)
    {
        builder.ToTable("poker_votes");
        builder.HasKey(v => new { v.SessionId, v.UserId });

        builder.Property(v => v.Value).IsRequired().HasMaxLength(10);
        builder.Property(v => v.CreatedAt).IsRequired();

        builder.HasOne(v => v.Session)
            .WithMany(s => s.Votes)
            .HasForeignKey(v => v.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(v => v.User)
            .WithMany()
            .HasForeignKey(v => v.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
