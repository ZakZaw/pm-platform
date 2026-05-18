using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Board;

public record GetBacklogQuery(Guid ProjectId) : IRequest<Result<BacklogDto>>;

public class GetBacklogQueryHandler(IAppDbContext db)
    : IRequestHandler<GetBacklogQuery, Result<BacklogDto>>
{
    public async Task<Result<BacklogDto>> Handle(GetBacklogQuery request, CancellationToken ct)
    {
        var projectKey = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => p.Key)
            .FirstOrDefaultAsync(ct) ?? "PR";

        var rows = await db.Tasks
            .Where(t => t.ProjectId == request.ProjectId)
            .OrderBy(t => t.PriorityOrder)
            .Select(t => new
            {
                t.Id, t.KeyNum, t.Title,
                Priority = t.Priority.ToString(),
                Status = t.Status.ToString(),
                t.StoryPoints, t.EpicId, t.SprintId, t.AssigneeId, t.DueDate, t.PriorityOrder,
                SubtaskCount = db.Subtasks.Count(s => s.TaskId == t.Id),
                CompletedSubtaskCount = db.Subtasks.Count(s => s.TaskId == t.Id && s.Completed),
                DonePts = (t.Status == DomainTaskStatus.Done ? (t.StoryPoints ?? 0) : 0),
                TotalPts = (t.StoryPoints ?? 0)
            })
            .ToListAsync(ct);

        var tasks = rows.Select(r => new
        {
            Dto = new BacklogTaskDto(
                r.Id, $"{projectKey}-{r.KeyNum}", r.KeyNum,
                r.Title, r.Priority, r.Status, r.StoryPoints,
                r.EpicId, r.SprintId, r.AssigneeId, r.DueDate, r.PriorityOrder,
                r.SubtaskCount, r.CompletedSubtaskCount),
            r.SprintId,
            r.TotalPts,
            r.DonePts
        }).ToList();

        var sprintRows = await db.Sprints
            .Where(s => s.ProjectId == request.ProjectId)
            .OrderByDescending(s => s.StartDate)
            .Select(s => new
            {
                s.Id, s.Name, s.Goal,
                Status = s.Status.ToString(),
                s.StartDate, s.EndDate
            })
            .ToListAsync(ct);

        var sections = sprintRows.Select(s =>
        {
            var bucket = tasks.Where(t => t.SprintId == s.Id).ToList();
            return new BacklogSprintSectionDto(
                s.Id, s.Name, s.Goal, s.Status, s.StartDate, s.EndDate,
                bucket.Sum(b => b.TotalPts),
                bucket.Sum(b => b.DonePts),
                bucket.Select(b => b.Dto).ToList());
        }).ToList();

        var unassigned = tasks.Where(t => t.SprintId is null).Select(t => t.Dto).ToList();

        return Result.Success(new BacklogDto(request.ProjectId, sections, unassigned));
    }
}
