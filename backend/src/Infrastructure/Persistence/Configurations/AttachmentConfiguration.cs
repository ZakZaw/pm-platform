using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class AttachmentConfiguration : IEntityTypeConfiguration<Attachment>
{
    public void Configure(EntityTypeBuilder<Attachment> builder)
    {
        builder.ToTable("attachments");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.TaskId).IsRequired();
        builder.Property(a => a.FileName).IsRequired().HasMaxLength(260);
        builder.Property(a => a.FileSize).IsRequired();
        builder.Property(a => a.ContentType).IsRequired().HasMaxLength(120);
        builder.Property(a => a.StorageKey).IsRequired().HasMaxLength(400);
        builder.Property(a => a.Url).IsRequired().HasMaxLength(1000);
        builder.Property(a => a.UploadedByUserId).IsRequired();
        builder.Property(a => a.CreatedAt).IsRequired();

        builder.HasIndex(a => a.TaskId);

        builder.HasOne(a => a.Task)
            .WithMany()
            .HasForeignKey(a => a.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.UploadedBy)
            .WithMany()
            .HasForeignKey(a => a.UploadedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
