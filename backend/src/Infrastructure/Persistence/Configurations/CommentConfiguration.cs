using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> builder)
    {
        builder.ToTable("comments");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.TaskId).IsRequired();
        builder.Property(c => c.AuthorId).IsRequired();
        builder.Property(c => c.BodyMd).IsRequired();
        builder.Property(c => c.MentionedUserIds)
            .HasColumnType("uuid[]")
            .HasDefaultValueSql("ARRAY[]::uuid[]");
        builder.Property(c => c.CreatedAt).IsRequired();
        builder.Property(c => c.EditedAt);

        builder.HasIndex(c => new { c.TaskId, c.CreatedAt });
        builder.HasIndex(c => c.AuthorId);

        builder.HasOne(c => c.Task)
            .WithMany()
            .HasForeignKey(c => c.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Author)
            .WithMany()
            .HasForeignKey(c => c.AuthorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
