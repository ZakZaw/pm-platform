using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Lists.Queries;

public record GetTaskListsViewQuery(Guid ProjectId)
    : IRequest<Result<TaskListsViewDto>>;

public class GetTaskListsViewQueryHandler(IAppDbContext db)
    : IRequestHandler<GetTaskListsViewQuery, Result<TaskListsViewDto>>
{
    private record TaskRow(
        Guid Id, int KeyNum, string Title, DomainTaskStatus Status,
        Domain.Enums.Priority Priority, Guid? AssigneeId, DateTime? DueDate,
        int? StoryPoints, Guid? TaskListId, DateTime CreatedAt,
        int SubtaskCount, int CompletedSubtaskCount);

    public async Task<Result<TaskListsViewDto>> Handle(
        GetTaskListsViewQuery request, CancellationToken ct)
    {
        var project = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => new { p.Key })
            .FirstOrDefaultAsync(ct);
        if (project is null) return Result.Failure<TaskListsViewDto>(ProjectErrors.NotFound);

        var lists = await db.TaskLists
            .Where(l => l.ProjectId == request.ProjectId)
            .OrderBy(l => l.Order)
            .ThenBy(l => l.CreatedAt)
            .ToListAsync(ct);

        var tasks = await db.Tasks
            .Where(t => t.ProjectId == request.ProjectId)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new TaskRow(
                t.Id, t.KeyNum, t.Title, t.Status, t.Priority, t.AssigneeId,
                t.DueDate, t.StoryPoints, t.TaskListId, t.CreatedAt,
                t.Subtasks.Count,
                t.Subtasks.Count(s => s.Completed)))
            .ToListAsync(ct);

        ListedTaskDto ToDto(TaskRow t) => new(
            t.Id, $"{project.Key}-{t.KeyNum}", t.Title,
            t.Status.ToString(), t.Priority.ToString(),
            t.AssigneeId, t.DueDate, t.StoryPoints,
            t.SubtaskCount, t.CompletedSubtaskCount, t.CreatedAt);

        var buckets = lists.Select(l => new TaskListBucketDto(
            l.Id, l.Name, l.Order, l.CreatedAt,
            tasks.Where(t => t.TaskListId == l.Id).Select(ToDto).ToList()
        )).ToList();

        var unsorted = tasks
            .Where(t => t.TaskListId == null)
            .Select(ToDto)
            .ToList();

        return Result.Success(new TaskListsViewDto(buckets, unsorted));
    }
}
