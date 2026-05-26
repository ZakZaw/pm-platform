using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using TaskEntity = Domain.Entities.Task;

namespace Application.Interfaces;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<Organization> Organizations { get; }
    DbSet<OrgMembership> OrgMemberships { get; }
    DbSet<Invitation> Invitations { get; }
    DbSet<Project> Projects { get; }
    DbSet<ProjectMembership> ProjectMemberships { get; }
    DbSet<Epic> Epics { get; }
    DbSet<TaskEntity> Tasks { get; }
    DbSet<Subtask> Subtasks { get; }
    DbSet<TaskStatusChange> TaskStatusChanges { get; }
    DbSet<Sprint> Sprints { get; }
    DbSet<ProjectStatusConfig> ProjectStatusConfigs { get; }
    DbSet<Comment> Comments { get; }
    DbSet<AIAuditLog> AIAuditLogs { get; }
    DbSet<AIGenerationRequest> AIGenerationRequests { get; }
    DbSet<AISuggestion> AISuggestions { get; }
    DbSet<ActivityLog> ActivityLogs { get; }
    DbSet<Notification> Notifications { get; }

    // F2-01 roadmap
    DbSet<EpicDependency> EpicDependencies { get; }
    DbSet<Milestone> Milestones { get; }

    // F2-06 shareable read-only roadmap link
    DbSet<RoadmapShareLink> RoadmapShareLinks { get; }

    // F2-07 task enhancements
    DbSet<Attachment> Attachments { get; }
    DbSet<Label> Labels { get; }
    DbSet<TaskLabel> TaskLabels { get; }
    DbSet<TimeLog> TimeLogs { get; }
    DbSet<PokerSession> PokerSessions { get; }
    DbSet<PokerVote> PokerVotes { get; }

    // F2-09 task-level dependencies feed the Task->Done unblock automation.
    DbSet<TaskDependency> TaskDependencies { get; }

    // F2-11 AI-generated retro per closed sprint.
    DbSet<SprintRetrospective> SprintRetrospectives { get; }

    // F2-04 dashboard customisation
    DbSet<UserDashboardLayout> UserDashboardLayouts { get; }

    // F2-05 custom fields
    DbSet<CustomFieldDefinition> CustomFieldDefinitions { get; }
    DbSet<CustomFieldValue> CustomFieldValues { get; }

    // Phase 1.5 Sales (F1.5-02)
    DbSet<DealStage> DealStages { get; }
    DbSet<Account> Accounts { get; }
    DbSet<Lead> Leads { get; }
    DbSet<Deal> Deals { get; }
    DbSet<Activity> Activities { get; }

    // Phase 1.5 Support (F1.5-03)
    DbSet<Customer> Customers { get; }
    DbSet<Queue> Queues { get; }
    DbSet<Ticket> Tickets { get; }
    DbSet<TicketReply> TicketReplies { get; }

    // Phase 1.5 Marketing (F1.5-04)
    DbSet<Campaign> Campaigns { get; }
    DbSet<Asset> Assets { get; }
    DbSet<MarketingTask> MarketingTasks { get; }

    // Phase 1.5 Generic (F1.5-06)
    DbSet<TaskList> TaskLists { get; }

    // Phase 1.5 Operations (F1.5-05)
    DbSet<Workflow> Workflows { get; }
    DbSet<WorkflowRun> WorkflowRuns { get; }
    DbSet<ChecklistItem> ChecklistItems { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
