using System.Reflection;
using Application.Interfaces;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using TaskEntity = Domain.Entities.Task;

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
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMembership> ProjectMemberships => Set<ProjectMembership>();
    public DbSet<Epic> Epics => Set<Epic>();
    public DbSet<TaskEntity> Tasks => Set<TaskEntity>();
    public DbSet<Subtask> Subtasks => Set<Subtask>();
    public DbSet<TaskStatusChange> TaskStatusChanges => Set<TaskStatusChange>();
    public DbSet<Sprint> Sprints => Set<Sprint>();
    public DbSet<ProjectStatusConfig> ProjectStatusConfigs => Set<ProjectStatusConfig>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<AIAuditLog> AIAuditLogs => Set<AIAuditLog>();
    public DbSet<AIGenerationRequest> AIGenerationRequests => Set<AIGenerationRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Team / TeamMembership stay ignored until the team-management
        // feature lands. Remove the Ignore call when their owning
        // F-task registers them with proper configurations.
        modelBuilder.Ignore<Team>();
        modelBuilder.Ignore<TeamMembership>();

        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
        base.OnModelCreating(modelBuilder);
    }
}
