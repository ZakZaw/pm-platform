using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class AIAuditLogConfiguration : IEntityTypeConfiguration<AIAuditLog>
{
    public void Configure(EntityTypeBuilder<AIAuditLog> builder)
    {
        builder.ToTable("ai_audit_logs");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.ActionType).IsRequired().HasMaxLength(80);
        builder.Property(l => l.Prompt).IsRequired();
        builder.Property(l => l.Response);
        builder.Property(l => l.BeforeStateJson);
        builder.Property(l => l.AfterStateJson);
        builder.Property(l => l.Provider).HasMaxLength(40).IsRequired();
        builder.Property(l => l.Model).HasMaxLength(80);
        builder.Property(l => l.ErrorMessage);
        builder.Property(l => l.Applied).IsRequired();
        builder.Property(l => l.CreatedAt).IsRequired();
        builder.Property(l => l.AppliedAt);

        builder.HasIndex(l => l.ProjectId);
        builder.HasIndex(l => new { l.UserId, l.CreatedAt });
    }
}
