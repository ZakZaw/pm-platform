using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class UserDashboardLayoutConfiguration : IEntityTypeConfiguration<UserDashboardLayout>
{
    public void Configure(EntityTypeBuilder<UserDashboardLayout> builder)
    {
        builder.ToTable("user_dashboard_layouts");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.UserId).IsRequired();
        builder.Property(l => l.ProjectId).IsRequired();
        builder.Property(l => l.LayoutJson).HasColumnType("jsonb").IsRequired();
        builder.Property(l => l.UpdatedAt).IsRequired();

        // One layout per (user, project). PUT becomes a logical upsert.
        builder.HasIndex(l => new { l.UserId, l.ProjectId }).IsUnique();

        builder.HasOne(l => l.User)
            .WithMany()
            .HasForeignKey(l => l.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(l => l.Project)
            .WithMany()
            .HasForeignKey(l => l.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
