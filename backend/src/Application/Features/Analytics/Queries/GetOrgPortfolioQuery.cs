using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// Org portfolio aggregate (F3-19, AN-09). Rolls up every non-personal,
/// non-archived project in the org into one payload: a type-agnostic health
/// score + a type-appropriate headline metric per project, an org-level rollup
/// strip, and the cross-project resource-conflict list (members carrying open
/// work in 2+ projects). One query per *present* project type keeps it to a
/// handful of round-trips regardless of project count — replacing the per-card
/// N+1 fetching the F1.5-08 portfolio page did client-side.
/// </summary>
public record GetOrgPortfolioQuery(string Slug) : IRequest<Result<OrgPortfolioDto>>;

public class GetOrgPortfolioQueryHandler(IAppDbContext db)
    : IRequestHandler<GetOrgPortfolioQuery, Result<OrgPortfolioDto>>
{
    // Cap the conflict list so an org with hundreds of shared members doesn't
    // return an unbounded payload; the worst-split people sort to the top.
    private const int MaxResourceConflicts = 15;

    private sealed class Signal
    {
        public int Open;
        public int Overdue;
        public int AtRisk;
        public decimal Money;
        public string? Currency;
    }

    public async Task<Result<OrgPortfolioDto>> Handle(GetOrgPortfolioQuery request, CancellationToken ct)
    {
        var orgId = await db.Organizations
            .Where(o => o.Slug == request.Slug)
            .Select(o => (Guid?)o.Id)
            .FirstOrDefaultAsync(ct);
        if (orgId is null)
            return Result.Failure<OrgPortfolioDto>(OrgErrors.NotFound);

        var projects = await db.Projects
            .Where(p => p.OrganizationId == orgId
                        && !p.IsPersonal
                        && p.Status != ProjectStatus.Archived)
            .Select(p => new { p.Id, p.Name, p.Slug, p.Key, p.Type })
            .ToListAsync(ct);

        if (projects.Count == 0)
            return Result.Success(new OrgPortfolioDto(
                new PortfolioRollupDto(0, 0, 0, 0, []), [], []));

        var today = DateTime.UtcNow.Date;
        var now = DateTime.UtcNow;

        var signals = projects.ToDictionary(p => p.Id, _ => new Signal());
        // Open-item load per (member, project) — the basis for resource conflicts.
        var loads = new Dictionary<(Guid User, Guid Project), int>();

        void AddLoad(Guid? userId, Guid projectId)
        {
            if (userId is not { } u) return;
            loads[(u, projectId)] = loads.GetValueOrDefault((u, projectId)) + 1;
        }

        List<Guid> IdsOf(params ProjectType[] types) =>
            projects.Where(p => types.Contains(p.Type)).Select(p => p.Id).ToList();

        // Engineering + Generic both model work as Tasks hung off the project.
        var taskIds = IdsOf(ProjectType.Engineering, ProjectType.Generic);
        if (taskIds.Count > 0)
        {
            var rows = await db.Tasks
                .Where(t => taskIds.Contains(t.ProjectId)
                            && t.Status != DomainTaskStatus.Done
                            && t.Status != DomainTaskStatus.WontDo)
                .Select(t => new { t.ProjectId, t.AssigneeId, t.DueDate, t.Status })
                .ToListAsync(ct);
            foreach (var r in rows)
            {
                var s = signals[r.ProjectId];
                s.Open++;
                if (r.DueDate is { } due && due.Date < today) s.Overdue++;
                if (r.Status == DomainTaskStatus.Blocked) s.AtRisk++;
                AddLoad(r.AssigneeId, r.ProjectId);
            }
        }

        // Sales — open Deals; headline is the open pipeline value.
        var salesIds = IdsOf(ProjectType.Sales);
        if (salesIds.Count > 0)
        {
            var rows = await db.Deals
                .Where(d => salesIds.Contains(d.ProjectId) && d.Status == DealStatus.Open)
                .Select(d => new { d.ProjectId, d.OwnerId, d.ExpectedClose, d.Value, d.Currency })
                .ToListAsync(ct);
            foreach (var r in rows)
            {
                var s = signals[r.ProjectId];
                s.Open++;
                s.Money += r.Value;
                s.Currency ??= r.Currency;
                if (r.ExpectedClose is { } close && close.Date < today) s.Overdue++;
                AddLoad(r.OwnerId, r.ProjectId);
            }
        }

        // Support — open Tickets; overdue == past the SLA due time.
        var supportIds = IdsOf(ProjectType.Support);
        if (supportIds.Count > 0)
        {
            var rows = await db.Tickets
                .Where(t => supportIds.Contains(t.ProjectId)
                            && t.Status != TicketStatus.Resolved
                            && t.Status != TicketStatus.Closed)
                .Select(t => new { t.ProjectId, t.AssigneeId, t.SlaDueAt })
                .ToListAsync(ct);
            foreach (var r in rows)
            {
                var s = signals[r.ProjectId];
                s.Open++;
                if (r.SlaDueAt < now) s.Overdue++;
                AddLoad(r.AssigneeId, r.ProjectId);
            }
        }

        // Marketing — open MarketingTasks, reached through their Campaign.
        var marketingIds = IdsOf(ProjectType.Marketing);
        if (marketingIds.Count > 0)
        {
            var rows = await db.MarketingTasks
                .Where(mt => marketingIds.Contains(mt.Campaign.ProjectId)
                             && mt.Status != MarketingTaskStatus.Done
                             && mt.Status != MarketingTaskStatus.Cancelled)
                .Select(mt => new { ProjectId = mt.Campaign.ProjectId, mt.AssigneeId, mt.DueDate })
                .ToListAsync(ct);
            foreach (var r in rows)
            {
                var s = signals[r.ProjectId];
                s.Open++;
                if (r.DueDate is { } due && due.Date < today) s.Overdue++;
                AddLoad(r.AssigneeId, r.ProjectId);
            }
        }

        // Operations — pending / in-progress WorkflowRuns, reached through their Workflow.
        var opsIds = IdsOf(ProjectType.Operations);
        if (opsIds.Count > 0)
        {
            var rows = await db.WorkflowRuns
                .Where(r => opsIds.Contains(r.Workflow.ProjectId)
                            && (r.Status == WorkflowRunStatus.Pending
                                || r.Status == WorkflowRunStatus.InProgress))
                .Select(r => new { ProjectId = r.Workflow.ProjectId, r.OwnerId, r.ScheduledFor })
                .ToListAsync(ct);
            foreach (var r in rows)
            {
                var s = signals[r.ProjectId];
                s.Open++;
                if (r.ScheduledFor.Date < today) s.Overdue++;
                AddLoad(r.OwnerId, r.ProjectId);
            }
        }

        // ---- Assemble per-project rows ----
        var projectDtos = projects
            .Select(p =>
            {
                var s = signals[p.Id];
                var health = PortfolioHealthCalculator.Score(new(s.Open, s.Overdue, s.AtRisk));
                var (label, value) = Headline(p.Type, s);
                return new PortfolioProjectDto(
                    p.Id, p.Name, p.Slug, p.Key, p.Type.ToString(),
                    health, PortfolioHealthCalculator.Band(health),
                    label, value, s.Open, s.Overdue, s.AtRisk);
            })
            .OrderBy(p => p.Health)        // worst health first — exec wants the risks up top
            .ThenBy(p => p.Name)
            .ToList();

        // ---- Org rollup ----
        var rollup = new PortfolioRollupDto(
            ProjectCount: projectDtos.Count,
            AtRiskCount: projectDtos.Count(p => p.Health < PortfolioHealthCalculator.AtRiskThreshold),
            TotalOpenItems: projectDtos.Sum(p => p.OpenItems),
            TotalOverdue: projectDtos.Sum(p => p.Overdue),
            ByType: projects
                .GroupBy(p => p.Type)
                .Select(g => new PortfolioTypeCountDto(g.Key.ToString(), g.Count()))
                .OrderByDescending(t => t.Count)
                .ToList());

        // ---- Cross-project resource conflicts ----
        var projectMeta = projects.ToDictionary(p => p.Id, p => (p.Name, Type: p.Type.ToString()));

        var conflicted = loads
            .GroupBy(kv => kv.Key.User)
            .Select(g => new
            {
                UserId = g.Key,
                Allocations = g.Select(kv => (Project: kv.Key.Project, Open: kv.Value)).ToList(),
            })
            .Where(x => x.Allocations.Count >= 2)
            .ToList();

        var conflicts = new List<PortfolioResourceConflictDto>();
        if (conflicted.Count > 0)
        {
            var userIds = conflicted.Select(c => c.UserId).ToList();
            var users = await db.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FullName, u.AvatarUrl })
                .ToDictionaryAsync(u => u.Id, ct);

            conflicts = conflicted
                .Select(c =>
                {
                    var allocations = c.Allocations
                        .Select(a => new PortfolioAllocationDto(
                            a.Project, projectMeta[a.Project].Name, projectMeta[a.Project].Type, a.Open))
                        .OrderByDescending(a => a.OpenItems)
                        .ToList();
                    users.TryGetValue(c.UserId, out var u);
                    return new PortfolioResourceConflictDto(
                        c.UserId,
                        u?.FullName ?? "Unknown",
                        u?.AvatarUrl,
                        allocations.Count,
                        allocations.Sum(a => a.OpenItems),
                        allocations);
                })
                .OrderByDescending(c => c.ProjectCount)
                .ThenByDescending(c => c.TotalOpenItems)
                .Take(MaxResourceConflicts)
                .ToList();
        }

        return Result.Success(new OrgPortfolioDto(rollup, projectDtos, conflicts));
    }

    private static (string Label, string Value) Headline(ProjectType type, Signal s) => type switch
    {
        ProjectType.Sales => ("Open pipeline", Money(s.Money, s.Currency ?? "USD")),
        ProjectType.Support => ("Open tickets", s.Open.ToString()),
        ProjectType.Marketing => ("Open work", s.Open.ToString()),
        ProjectType.Operations => ("Open runs", s.Open.ToString()),
        _ => ("Open tasks", s.Open.ToString()),
    };

    // Compact money for an exec rollup: $1.2M / $14k / $850.
    private static string Money(decimal value, string currency)
    {
        var sym = currency switch
        {
            "USD" => "$", "EUR" => "€", "GBP" => "£", "JPY" => "¥",
            _ => currency + " ",
        };
        return value switch
        {
            >= 1_000_000 => $"{sym}{value / 1_000_000m:0.#}M",
            >= 1_000 => $"{sym}{value / 1_000m:0.#}k",
            _ => $"{sym}{value:0}",
        };
    }
}
