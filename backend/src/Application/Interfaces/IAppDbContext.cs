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

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
