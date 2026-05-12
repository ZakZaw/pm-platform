using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.ToTable("organizations");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.Name).IsRequired().HasMaxLength(80);
        builder.Property(o => o.Slug).IsRequired().HasMaxLength(80);
        builder.HasIndex(o => o.Slug).IsUnique();

        builder.Property(o => o.LogoUrl).HasMaxLength(512);
        builder.Property(o => o.Plan).HasConversion<string>().HasMaxLength(20);
        builder.Property(o => o.SsoEnabled).IsRequired();
        builder.Property(o => o.CreatedAt).IsRequired();

        builder.Ignore(o => o.Projects);
        builder.Ignore(o => o.Teams);
    }
}
