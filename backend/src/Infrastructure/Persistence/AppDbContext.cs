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
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();
    public DbSet<Notification> Notifications => Set<Notification>();

    // F2-01 roadmap
    public DbSet<EpicDependency> EpicDependencies => Set<EpicDependency>();
    public DbSet<Milestone> Milestones => Set<Milestone>();

    // F2-06 shareable read-only roadmap link
    public DbSet<RoadmapShareLink> RoadmapShareLinks => Set<RoadmapShareLink>();

    // F2-07 task enhancements
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<Label> Labels => Set<Label>();
    public DbSet<TaskLabel> TaskLabels => Set<TaskLabel>();
    public DbSet<TimeLog> TimeLogs => Set<TimeLog>();
    public DbSet<PokerSession> PokerSessions => Set<PokerSession>();
    public DbSet<PokerVote> PokerVotes => Set<PokerVote>();

    // F2-09 task-level dependencies (Task->Done unblock automation).
    public DbSet<TaskDependency> TaskDependencies => Set<TaskDependency>();

    // F2-11 AI sprint retrospective (one per closed sprint).
    public DbSet<SprintRetrospective> SprintRetrospectives => Set<SprintRetrospective>();

    // F2-04 dashboard customisation
    public DbSet<UserDashboardLayout> UserDashboardLayouts => Set<UserDashboardLayout>();

    // F2-05 custom fields
    public DbSet<CustomFieldDefinition> CustomFieldDefinitions => Set<CustomFieldDefinition>();
    public DbSet<CustomFieldValue> CustomFieldValues => Set<CustomFieldValue>();

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

    // Phase 1.5 Marketing (F1.5-04)
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<MarketingTask> MarketingTasks => Set<MarketingTask>();

    // Phase 1.5 Generic (F1.5-06)
    public DbSet<TaskList> TaskLists => Set<TaskList>();

    // Phase 1.5 Operations (F1.5-05)
    public DbSet<Workflow> Workflows => Set<Workflow>();
    public DbSet<WorkflowRun> WorkflowRuns => Set<WorkflowRun>();
    public DbSet<ChecklistItem> ChecklistItems => Set<ChecklistItem>();

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
