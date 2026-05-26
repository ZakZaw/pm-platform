using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class SprintRetrospectiveConfiguration : IEntityTypeConfiguration<SprintRetrospective>
{
    public void Configure(EntityTypeBuilder<SprintRetrospective> builder)
    {
        builder.ToTable("sprint_retrospectives");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.SprintId).IsRequired();
        builder.Property(r => r.Summary).IsRequired();
        builder.Property(r => r.WhatWentWell).IsRequired();
        builder.Property(r => r.WhatDidnt).IsRequired();
        builder.Property(r => r.Suggestions).IsRequired();
        builder.Property(r => r.Provider).HasMaxLength(40).IsRequired();
        builder.Property(r => r.Model).HasMaxLength(60).IsRequired();
        builder.Property(r => r.GeneratedByUserId).IsRequired();
        builder.Property(r => r.GeneratedAt).IsRequired();

        // One retro per sprint at any given time. Regeneration replaces;
        // ApplyNextSprintDraft writes the apply fields but keeps the row.
        builder.HasIndex(r => r.SprintId).IsUnique();

        builder.HasOne(r => r.Sprint)
            .WithMany()
            .HasForeignKey(r => r.SprintId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
