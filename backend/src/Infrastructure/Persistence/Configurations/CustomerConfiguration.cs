using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("customers");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.ProjectId).IsRequired();
        builder.Property(c => c.Name).IsRequired().HasMaxLength(200);
        builder.Property(c => c.Email).HasMaxLength(200);
        builder.Property(c => c.Company).HasMaxLength(200);
        builder.Property(c => c.Tier).HasMaxLength(40);
        builder.Property(c => c.CreatedAt).IsRequired();

        builder.HasIndex(c => new { c.ProjectId, c.Name });
        builder.HasIndex(c => c.Email);

        builder.HasOne(c => c.Project)
            .WithMany()
            .HasForeignKey(c => c.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
