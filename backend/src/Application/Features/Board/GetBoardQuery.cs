using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Board;

public record GetBoardQuery(Guid ProjectId, Guid? SprintId, string? SwimlaneBy)
    : IRequest<Result<BoardDto>>;

public class GetBoardQueryHandler(IAppDbContext db)
    : IRequestHandler<GetBoardQuery, Result<BoardDto>>
{
    private static readonly string[] FallbackStatuses =
        [nameof(DomainTaskStatus.ToDo), nameof(DomainTaskStatus.InProgress),
         nameof(DomainTaskStatus.InReview), nameof(DomainTaskStatus.Blocked),
         nameof(DomainTaskStatus.Done)];

    public async Task<Result<BoardDto>> Handle(GetBoardQuery request, CancellationToken ct)
    {
        var projectKey = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => p.Key)
            .FirstOrDefaultAsync(ct) ?? "PR";

        var tasksQuery = db.Tasks.Where(t => t.ProjectId == request.ProjectId);
        if (request.SprintId.HasValue)
            tasksQuery = tasksQuery.Where(t => t.SprintId == request.SprintId);
        else
            tasksQuery = tasksQuery.Where(t => t.Status != DomainTaskStatus.Backlog);

        var rows = await tasksQuery
            .OrderBy(t => t.PriorityOrder)
            .Select(t => new
            {
                t.Id,
                t.KeyNum,
                t.Title,
                Priority = t.Priority.ToString(),
                Status = t.Status.ToString(),
                t.StoryPoints,
                t.AssigneeId,
                t.EpicId,
                t.SprintId,
                SubtaskCount = db.Subtasks.Count(st => st.TaskId == t.Id),
                CompletedSubtaskCount = db.Subtasks.Count(st => st.TaskId == t.Id && st.Completed)
            })
            .ToListAsync(ct);

        var cards = rows.Select(r => new BoardCardDto(
            r.Id, $"{projectKey}-{r.KeyNum}", r.KeyNum,
            r.Title, r.Priority, r.Status, r.StoryPoints,
            r.AssigneeId, r.EpicId, r.SprintId,
            r.SubtaskCount, r.CompletedSubtaskCount)).ToList();

        var columnOrder = await db.ProjectStatusConfigs
            .Where(c => c.ProjectId == request.ProjectId && c.IsVisible)
            .OrderBy(c => c.OrderIndex)
            .Select(c => c.Status.ToString())
            .ToListAsync(ct);
        if (columnOrder.Count == 0)
            columnOrder = FallbackStatuses.ToList();

        var swimlanes = BuildSwimlanes(cards, request.SwimlaneBy, columnOrder);

        return Result.Success(new BoardDto(request.ProjectId, request.SprintId, request.SwimlaneBy, swimlanes));
    }

    private static IReadOnlyList<SwimlaneDto> BuildSwimlanes(
        IReadOnlyList<BoardCardDto> cards, string? swimlaneBy, IReadOnlyList<string> columnOrder)
    {
        if (string.IsNullOrEmpty(swimlaneBy))
            return new[] { new SwimlaneDto("all", "All", ToColumns(cards, columnOrder)) };

        IEnumerable<IGrouping<string, BoardCardDto>> groups = swimlaneBy.ToLowerInvariant() switch
        {
            "assignee" => cards.GroupBy(c => c.AssigneeId?.ToString() ?? "unassigned"),
            "epic" => cards.GroupBy(c => c.EpicId?.ToString() ?? "no-epic"),
            "priority" => cards.GroupBy(c => c.Priority),
            _ => new[] { cards.GroupBy(_ => "all").First() }
        };

        return groups
            .OrderBy(g => g.Key == "unassigned" || g.Key == "no-epic" ? 1 : 0)
            .ThenBy(g => g.Key)
            .Select(g => new SwimlaneDto(g.Key, g.Key, ToColumns(g.ToList(), columnOrder)))
            .ToList();
    }

    private static IReadOnlyList<BoardColumnDto> ToColumns(
        IReadOnlyList<BoardCardDto> cards, IReadOnlyList<string> columnOrder)
    {
        return columnOrder.Select(status => new BoardColumnDto(
            status,
            cards.Where(c => c.Status == status).ToList()
        )).ToList();
    }
}
