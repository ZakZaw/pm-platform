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
    private static readonly string[] CoreStatuses =
        [nameof(DomainTaskStatus.ToDo), nameof(DomainTaskStatus.InProgress),
         nameof(DomainTaskStatus.InReview), nameof(DomainTaskStatus.Blocked),
         nameof(DomainTaskStatus.Done)];

    public async Task<Result<BoardDto>> Handle(GetBoardQuery request, CancellationToken ct)
    {
        var storiesQuery = db.Stories.Where(s => s.ProjectId == request.ProjectId);
        if (request.SprintId.HasValue)
            storiesQuery = storiesQuery.Where(s => s.SprintId == request.SprintId);
        else
            storiesQuery = storiesQuery.Where(s => s.Status != DomainTaskStatus.Backlog);

        var rows = await storiesQuery
            .OrderBy(s => s.PriorityOrder)
            .Select(s => new
            {
                s.Id,
                s.Title,
                Priority = s.Priority.ToString(),
                Status = s.Status.ToString(),
                s.StoryPoints,
                s.AssigneeId,
                s.EpicId,
                TaskCount = db.Tasks.Count(t => t.StoryId == s.Id),
                CompletedTaskCount = db.Tasks.Count(t => t.StoryId == s.Id && t.Status == DomainTaskStatus.Done)
            })
            .ToListAsync(ct);

        var cards = rows.Select(r => new BoardCardDto(
            r.Id, r.Title, r.Priority, r.Status, r.StoryPoints, r.AssigneeId, r.EpicId,
            r.TaskCount, r.CompletedTaskCount)).ToList();

        var swimlanes = BuildSwimlanes(cards, request.SwimlaneBy);

        return Result.Success(new BoardDto(request.ProjectId, request.SprintId, request.SwimlaneBy, swimlanes));
    }

    private static IReadOnlyList<SwimlaneDto> BuildSwimlanes(
        IReadOnlyList<BoardCardDto> cards, string? swimlaneBy)
    {
        // No swimlanes: one synthetic lane with all columns.
        if (string.IsNullOrEmpty(swimlaneBy))
            return new[] { new SwimlaneDto("all", "All", ToColumns(cards)) };

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
            .Select(g => new SwimlaneDto(g.Key, g.Key, ToColumns(g.ToList())))
            .ToList();
    }

    private static IReadOnlyList<BoardColumnDto> ToColumns(IReadOnlyList<BoardCardDto> cards)
    {
        return CoreStatuses.Select(status => new BoardColumnDto(
            status,
            cards.Where(c => c.Status == status).ToList()
        )).ToList();
    }
}
