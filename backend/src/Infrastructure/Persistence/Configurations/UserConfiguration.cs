using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.Email).IsRequired().HasMaxLength(254);
        builder.HasIndex(u => u.Email).IsUnique();

        builder.Property(u => u.PasswordHash).IsRequired().HasMaxLength(512);
        builder.Property(u => u.FullName).IsRequired().HasMaxLength(120);
        builder.Property(u => u.AvatarUrl).HasMaxLength(512);
        builder.Property(u => u.Timezone).IsRequired().HasMaxLength(64).HasDefaultValue("UTC");
        // Npgsql maps string[] to text[] natively. No conversion needed.
        builder.Property(u => u.SkillTags)
            .HasColumnType("text[]")
            .HasDefaultValueSql("ARRAY[]::text[]");
        builder.Property(u => u.CapacityHoursPerWeek).IsRequired().HasDefaultValue(40);
        builder.Property(u => u.CreatedAt).IsRequired();
    }
}
