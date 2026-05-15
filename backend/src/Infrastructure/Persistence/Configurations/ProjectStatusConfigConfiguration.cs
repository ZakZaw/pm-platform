using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class ProjectStatusConfigConfiguration : IEntityTypeConfiguration<ProjectStatusConfig>
{
    public void Configure(EntityTypeBuilder<ProjectStatusConfig> builder)
    {
        builder.ToTable("project_status_configs");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.ProjectId).IsRequired();
        builder.Property(c => c.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(c => c.DisplayName).IsRequired().HasMaxLength(60);
        builder.Property(c => c.Color).IsRequired().HasMaxLength(20);
        builder.Property(c => c.OrderIndex).IsRequired();
        builder.Property(c => c.IsDoneState).IsRequired();
        builder.Property(c => c.IsVisible).IsRequired();
        builder.Property(c => c.CreatedAt).IsRequired();

        builder.HasIndex(c => new { c.ProjectId, c.Status }).IsUnique();
        builder.HasIndex(c => c.ProjectId);

        builder.HasOne(c => c.Project)
            .WithMany()
            .HasForeignKey(c => c.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
