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
    public DbSet<AISuggestion> AISuggestions => Set<AISuggestion>();

    // Phase 1.5 Sales (F1.5-02)
    public DbSet<DealStage> DealStages => Set<DealStage>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<Deal> Deals => Set<Deal>();
    public DbSet<Activity> Activities => Set<Activity>();

    // Phase 1.5 Support (F1.5-03)
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Queue> Queues => Set<Queue>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<TicketReply> TicketReplies => Set<TicketReply>();

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
