using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class AISuggestionConfiguration : IEntityTypeConfiguration<AISuggestion>
{
    public void Configure(EntityTypeBuilder<AISuggestion> builder)
    {
        builder.ToTable("ai_suggestions");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Kind).IsRequired().HasMaxLength(80);
        builder.Property(s => s.Title).IsRequired().HasMaxLength(240);
        builder.Property(s => s.Body);
        builder.Property(s => s.PayloadJson);
        builder.Property(s => s.Status).IsRequired().HasMaxLength(20);
        builder.Property(s => s.Provider).HasMaxLength(40).IsRequired();
        builder.Property(s => s.Model).HasMaxLength(80).IsRequired();
        builder.Property(s => s.CreatedAt).IsRequired();
        builder.Property(s => s.ActedAt);

        builder.HasOne(s => s.Project)
               .WithMany()
               .HasForeignKey(s => s.ProjectId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.ProjectId, s.Status, s.CreatedAt });
    }
}
