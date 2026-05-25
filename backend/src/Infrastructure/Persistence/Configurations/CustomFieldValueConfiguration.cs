using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class CustomFieldValueConfiguration : IEntityTypeConfiguration<CustomFieldValue>
{
    public void Configure(EntityTypeBuilder<CustomFieldValue> builder)
    {
        builder.ToTable("custom_field_values");

        builder.HasKey(v => v.Id);

        builder.Property(v => v.TaskId).IsRequired();
        builder.Property(v => v.DefinitionId).IsRequired();
        builder.Property(v => v.ValueJson).IsRequired().HasColumnType("jsonb");
        builder.Property(v => v.UpdatedAt).IsRequired();

        // One value per (task, definition). Re-saving overwrites in place.
        builder.HasIndex(v => new { v.TaskId, v.DefinitionId }).IsUnique();

        builder.HasOne(v => v.Task)
            .WithMany()
            .HasForeignKey(v => v.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(v => v.Definition)
            .WithMany(d => d.Values)
            .HasForeignKey(v => v.DefinitionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
