using System.Reflection;
using Application.Interfaces;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence;

public class AppDbContext : DbContext, IAppDbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<OrgMembership> OrgMemberships => Set<OrgMembership>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Domain entities scaffolded ahead of their F-task are excluded from
        // the model until their owning task registers them with proper
        // configurations. Remove the relevant Ignore call when adding the
        // DbSet/IEntityTypeConfiguration for that entity.
        modelBuilder.Ignore<Project>();
        modelBuilder.Ignore<ProjectMembership>();
        modelBuilder.Ignore<Team>();
        modelBuilder.Ignore<TeamMembership>();

        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
        base.OnModelCreating(modelBuilder);
    }
}
