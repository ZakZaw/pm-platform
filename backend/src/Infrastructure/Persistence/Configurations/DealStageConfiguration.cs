using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class DealStageConfiguration : IEntityTypeConfiguration<DealStage>
{
    public void Configure(EntityTypeBuilder<DealStage> builder)
    {
        builder.ToTable("deal_stages");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.ProjectId).IsRequired();
        builder.Property(s => s.Name).IsRequired().HasMaxLength(60);
        builder.Property(s => s.Order).IsRequired();
        builder.Property(s => s.DefaultProbability).IsRequired();
        builder.Property(s => s.IsTerminalWon).IsRequired();
        builder.Property(s => s.IsTerminalLost).IsRequired();
        builder.Property(s => s.CreatedAt).IsRequired();

        builder.HasIndex(s => new { s.ProjectId, s.Order });

        builder.HasOne(s => s.Project)
            .WithMany()
            .HasForeignKey(s => s.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
