using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Application.Authorization;

/// <summary>
/// Single entry point for "may this caller touch this project / org?".
/// Used by the <c>[RequireProjectRole]</c> / <c>[RequireOrgRole]</c> API
/// filters, by the SignalR hub, and by the few handlers whose scope is
/// only known after parsing the request (e.g. task-by-key).
/// </summary>
public interface IAccessControl
{
    /// <summary>Maps an entity id to its owning project's id; null when the entity doesn't exist.</summary>
    Task<Guid?> ResolveProjectIdAsync(ProjectScope scope, Guid id, CancellationToken ct);

    /// <summary>Maps a slug / entity id to the owning org's id; null when it doesn't exist.</summary>
    Task<Guid?> ResolveOrgIdAsync(OrgScope scope, string key, CancellationToken ct);

    Task<Result> CheckProjectAsync(AccessPrincipal principal, Guid projectId, ProjectRole minimum, CancellationToken ct);

    Task<Result> CheckOrgAsync(AccessPrincipal principal, Guid orgId, OrgRole minimum, CancellationToken ct);

    /// <summary>The current HTTP caller, or null when unauthenticated.</summary>
    AccessPrincipal? CurrentPrincipal();
}

public class AccessControl(IAppDbContext db, ICurrentUser currentUser) : IAccessControl
{
    public AccessPrincipal? CurrentPrincipal() =>
        currentUser.UserId is { } id ? new AccessPrincipal(id, currentUser.ApiKeyOrgId) : null;

    public async Task<Guid?> ResolveProjectIdAsync(ProjectScope scope, Guid id, CancellationToken ct)
    {
        var ids = await ProjectIdQuery(scope, id).Take(1).ToListAsync(ct);
        return ids.Count == 0 ? null : ids[0];
    }

    /// <summary>
    /// One translatable query per scope. Joins (rather than navigations)
    /// keep this independent of which nav properties an entity happens to
    /// declare. Public so a unit test can assert every scope translates.
    /// </summary>
    public IQueryable<Guid> ProjectIdQuery(ProjectScope scope, Guid id) => scope switch
    {
        ProjectScope.Project => db.Projects.Where(p => p.Id == id).Select(p => p.Id),
        ProjectScope.Task => db.Tasks.Where(t => t.Id == id).Select(t => t.ProjectId),
        ProjectScope.Epic => db.Epics.Where(e => e.Id == id).Select(e => e.ProjectId),
        ProjectScope.Sprint => db.Sprints.Where(s => s.Id == id).Select(s => s.ProjectId),
        ProjectScope.Subtask =>
            from s in db.Subtasks join t in db.Tasks on s.TaskId equals t.Id
            where s.Id == id select t.ProjectId,
        ProjectScope.Attachment =>
            from a in db.Attachments join t in db.Tasks on a.TaskId equals t.Id
            where a.Id == id select t.ProjectId,
        ProjectScope.Comment =>
            from c in db.Comments join t in db.Tasks on c.TaskId equals t.Id
            where c.Id == id select t.ProjectId,
        ProjectScope.TimeLog =>
            from l in db.TimeLogs join t in db.Tasks on l.TaskId equals t.Id
            where l.Id == id select t.ProjectId,
        ProjectScope.Label => db.Labels.Where(l => l.Id == id).Select(l => l.ProjectId),
        ProjectScope.TaskList => db.TaskLists.Where(l => l.Id == id).Select(l => l.ProjectId),
        ProjectScope.PokerSession => db.PokerSessions.Where(p => p.Id == id).Select(p => p.ProjectId),
        ProjectScope.Campaign => db.Campaigns.Where(c => c.Id == id).Select(c => c.ProjectId),
        ProjectScope.Asset =>
            from a in db.Assets join c in db.Campaigns on a.CampaignId equals c.Id
            where a.Id == id select c.ProjectId,
        ProjectScope.MarketingTask =>
            from m in db.MarketingTasks join c in db.Campaigns on m.CampaignId equals c.Id
            where m.Id == id select c.ProjectId,
        ProjectScope.Workflow => db.Workflows.Where(w => w.Id == id).Select(w => w.ProjectId),
        ProjectScope.WorkflowRun =>
            from r in db.WorkflowRuns join w in db.Workflows on r.WorkflowId equals w.Id
            where r.Id == id select w.ProjectId,
        ProjectScope.ChecklistItem =>
            from i in db.ChecklistItems
            join r in db.WorkflowRuns on i.RunId equals r.Id
            join w in db.Workflows on r.WorkflowId equals w.Id
            where i.Id == id select w.ProjectId,
        ProjectScope.DealStage => db.DealStages.Where(s => s.Id == id).Select(s => s.ProjectId),
        ProjectScope.Account => db.Accounts.Where(a => a.Id == id).Select(a => a.ProjectId),
        ProjectScope.Deal => db.Deals.Where(d => d.Id == id).Select(d => d.ProjectId),
        ProjectScope.Lead => db.Leads.Where(l => l.Id == id).Select(l => l.ProjectId),
        ProjectScope.Queue => db.Queues.Where(q => q.Id == id).Select(q => q.ProjectId),
        ProjectScope.Customer => db.Customers.Where(c => c.Id == id).Select(c => c.ProjectId),
        ProjectScope.Ticket => db.Tickets.Where(t => t.Id == id).Select(t => t.ProjectId),
        ProjectScope.Meeting => db.Meetings.Where(m => m.Id == id).Select(m => m.ProjectId),
        ProjectScope.MeetingGuestLink =>
            from g in db.MeetingGuestLinks join m in db.Meetings on g.MeetingId equals m.Id
            where g.Id == id select m.ProjectId,
        ProjectScope.MeetingActionItem =>
            from a in db.MeetingActionItems join m in db.Meetings on a.MeetingId equals m.Id
            where a.Id == id select m.ProjectId,
        ProjectScope.Integration => db.Integrations.Where(i => i.Id == id).Select(i => i.ProjectId),
        ProjectScope.AISuggestion => db.AISuggestions.Where(s => s.Id == id).Select(s => s.ProjectId),
        _ => throw new ArgumentOutOfRangeException(nameof(scope), scope, "No project resolver for this scope."),
    };

    public async Task<Guid?> ResolveOrgIdAsync(OrgScope scope, string key, CancellationToken ct)
    {
        if (scope == OrgScope.Slug)
        {
            if (string.IsNullOrWhiteSpace(key)) return null;
            var bySlug = await db.Organizations.Where(o => o.Slug == key)
                .Select(o => o.Id).Take(1).ToListAsync(ct);
            return bySlug.Count == 0 ? null : bySlug[0];
        }

        if (!Guid.TryParse(key, out var id)) return null;
        var ids = await OrgIdQuery(scope, id).Take(1).ToListAsync(ct);
        return ids.Count == 0 ? null : ids[0];
    }

    public IQueryable<Guid> OrgIdQuery(OrgScope scope, Guid id) => scope switch
    {
        OrgScope.Organization => db.Organizations.Where(o => o.Id == id).Select(o => o.Id),
        OrgScope.Channel => db.Channels.Where(c => c.Id == id).Select(c => c.OrganizationId),
        OrgScope.Message =>
            from m in db.Messages join c in db.Channels on m.ChannelId equals c.Id
            where m.Id == id select c.OrganizationId,
        OrgScope.ApiKey => db.ApiKeys.Where(k => k.Id == id).Select(k => k.OrganizationId),
        OrgScope.AIGenerationRequest => db.AIGenerationRequests.Where(r => r.Id == id).Select(r => r.OrganizationId),
        _ => throw new ArgumentOutOfRangeException(nameof(scope), scope, "No org resolver for this scope."),
    };

    public async Task<Result> CheckProjectAsync(
        AccessPrincipal principal, Guid projectId, ProjectRole minimum, CancellationToken ct)
    {
        var project = await db.Projects
            .Where(p => p.Id == projectId)
            .Select(p => new { p.IsPersonal, p.OwnerUserId, p.OrganizationId })
            .FirstOrDefaultAsync(ct);
        if (project is null)
            return AccessPolicy.EvaluateProject(null, principal, minimum);

        ProjectRole? role = null;
        var activeOrgMember = false;
        if (!project.IsPersonal)
        {
            role = await db.ProjectMemberships
                .Where(m => m.ProjectId == projectId && m.UserId == principal.UserId)
                .Select(m => (ProjectRole?)m.Role)
                .FirstOrDefaultAsync(ct);
            activeOrgMember = project.OrganizationId is { } orgId && await db.OrgMemberships
                .AnyAsync(m => m.OrganizationId == orgId
                            && m.UserId == principal.UserId
                            && m.RemovedAt == null, ct);
        }

        return AccessPolicy.EvaluateProject(
            new ProjectAccessFacts(project.IsPersonal, project.OwnerUserId, project.OrganizationId, activeOrgMember, role),
            principal, minimum);
    }

    public async Task<Result> CheckOrgAsync(
        AccessPrincipal principal, Guid orgId, OrgRole minimum, CancellationToken ct)
    {
        var exists = await db.Organizations.AnyAsync(o => o.Id == orgId, ct);
        if (!exists)
            return AccessPolicy.EvaluateOrg(null, principal, minimum);

        var role = await db.OrgMemberships
            .Where(m => m.OrganizationId == orgId && m.UserId == principal.UserId && m.RemovedAt == null)
            .Select(m => (OrgRole?)m.Role)
            .FirstOrDefaultAsync(ct);

        return AccessPolicy.EvaluateOrg(new OrgAccessFacts(orgId, role), principal, minimum);
    }
}
