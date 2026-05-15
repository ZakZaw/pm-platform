using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class ProjectMembershipConfiguration : IEntityTypeConfiguration<ProjectMembership>
{
    public void Configure(EntityTypeBuilder<ProjectMembership> builder)
    {
        builder.ToTable("project_memberships");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.ProjectId).IsRequired();
        builder.Property(m => m.UserId).IsRequired();
        builder.Property(m => m.Role).HasConversion<string>().HasMaxLength(20);
        builder.Property(m => m.JoinedAt).IsRequired();

        builder.HasIndex(m => new { m.ProjectId, m.UserId }).IsUnique();

        builder.HasOne(m => m.Project)
            .WithMany(p => p.Memberships)
            .HasForeignKey(m => m.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.User)
            .WithMany(u => u.ProjectMemberships)
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
