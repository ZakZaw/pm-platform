using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Operations.Queries;

/// <summary>
/// Cross-project list of operations runs assigned to the current user.
/// Defaults to overdue + due-this-week so MyWork can render them in one
/// shot — satisfies the F1.5-05 AC "overdue runs surface in My Work for
/// the owner".
/// </summary>
public record GetMyOperationsRunsQuery(int? WindowDays = 7)
    : IRequest<Result<IReadOnlyList<MyRunDto>>>;

public record MyRunDto(
    Guid Id,
    Guid WorkflowId,
    string WorkflowName,
    Guid ProjectId,
    string ProjectSlug,
    string ProjectName,
    string? OrgSlug,
    DateTime ScheduledFor,
    string Status,
    bool IsOverdue,
    int ItemCount,
    int CompletedItemCount);

public class GetMyOperationsRunsQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetMyOperationsRunsQuery, Result<IReadOnlyList<MyRunDto>>>
{
    public async Task<Result<IReadOnlyList<MyRunDto>>> Handle(
        GetMyOperationsRunsQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<IReadOnlyList<MyRunDto>>(AuthErrors.NotAuthenticated);

        var now = DateTime.UtcNow;
        var windowEnd = now.AddDays(Math.Max(1, request.WindowDays ?? 7));

        var rows = await (
            from r in db.WorkflowRuns
            join w in db.Workflows on r.WorkflowId equals w.Id
            join p in db.Projects on w.ProjectId equals p.Id
            where r.OwnerId == userId
                  && (r.Status == WorkflowRunStatus.Pending || r.Status == WorkflowRunStatus.InProgress)
                  && r.ScheduledFor <= windowEnd
            select new
            {
                r.Id,
                WorkflowId = w.Id,
                WorkflowName = w.Name,
                ProjectId = p.Id,
                ProjectSlug = p.Slug,
                ProjectName = p.Name,
                OrgSlug = p.Organization != null ? p.Organization.Slug : null,
                r.ScheduledFor,
                Status = r.Status.ToString(),
                ItemCount = r.Items.Count,
                CompletedItemCount = r.Items.Count(i => i.Completed),
            })
            .OrderBy(x => x.ScheduledFor)
            .ToListAsync(ct);

        var dtos = rows.Select(x => new MyRunDto(
            x.Id, x.WorkflowId, x.WorkflowName,
            x.ProjectId, x.ProjectSlug, x.ProjectName, x.OrgSlug,
            x.ScheduledFor, x.Status,
            IsOverdue: x.ScheduledFor <= now,
            x.ItemCount, x.CompletedItemCount)).ToList();

        return Result.Success<IReadOnlyList<MyRunDto>>(dtos);
    }
}
