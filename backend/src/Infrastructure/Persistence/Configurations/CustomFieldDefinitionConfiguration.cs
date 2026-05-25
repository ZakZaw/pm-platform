using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class CustomFieldDefinitionConfiguration : IEntityTypeConfiguration<CustomFieldDefinition>
{
    public void Configure(EntityTypeBuilder<CustomFieldDefinition> builder)
    {
        builder.ToTable("custom_field_definitions");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.ProjectId).IsRequired();
        builder.Property(d => d.Name).IsRequired().HasMaxLength(120);
        builder.Property(d => d.FieldType).HasConversion<string>().HasMaxLength(20);
        builder.Property(d => d.OptionsJson).HasColumnType("jsonb");
        builder.Property(d => d.Required).IsRequired();
        builder.Property(d => d.SortOrder).IsRequired();
        builder.Property(d => d.CreatedAt).IsRequired();
        builder.Property(d => d.DeletedAt);

        // Field names are unique per project among live (non-deleted) rows.
        // Soft-deleted rows keep their name so the audit/history is intact.
        // The filter must use the literal column name EF generates ("DeletedAt").
        builder.HasIndex(d => new { d.ProjectId, d.Name })
            .HasFilter("\"DeletedAt\" IS NULL")
            .IsUnique();

        builder.HasIndex(d => new { d.ProjectId, d.SortOrder });

        builder.HasOne(d => d.Project)
            .WithMany()
            .HasForeignKey(d => d.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
