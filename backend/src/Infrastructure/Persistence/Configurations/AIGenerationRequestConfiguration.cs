using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class AIGenerationRequestConfiguration : IEntityTypeConfiguration<AIGenerationRequest>
{
    public void Configure(EntityTypeBuilder<AIGenerationRequest> builder)
    {
        builder.ToTable("ai_generation_requests");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.OrganizationId).IsRequired();
        builder.Property(r => r.CreatedBy).IsRequired();
        builder.Property(r => r.Description).IsRequired();
        builder.Property(r => r.EnvironmentType).IsRequired().HasMaxLength(40);
        builder.Property(r => r.ClarificationsJson);
        builder.Property(r => r.PreviewJson).IsRequired();
        builder.Property(r => r.Status).IsRequired().HasMaxLength(20);
        builder.Property(r => r.AppliedProjectId);
        builder.Property(r => r.CreatedAt).IsRequired();
        builder.Property(r => r.AppliedAt);

        builder.HasIndex(r => new { r.OrganizationId, r.CreatedAt });
        builder.HasIndex(r => new { r.CreatedBy, r.Status });
    }
}
