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

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
