using Application.Common;
using Application.Features.Tasks.Commands;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using TaskEntity = Domain.Entities.Task;

namespace Application.Features.Tasks.Queries;

public record ListProjectTasksQuery(
    Guid ProjectId,
    Guid? EpicId,
    Guid? SprintId,
    Guid? AssigneeId,
    bool IncludeDone,
    // F2-02 list view extensions
    IReadOnlyList<string>? Statuses = null,
    IReadOnlyList<string>? Priorities = null,
    string? Search = null,
    bool? NoEpic = null,
    bool? NoSprint = null,
    bool? NoAssignee = null,
    DateTime? DueAfter = null,
    DateTime? DueBefore = null,
    string? Sort = null) : IRequest<Result<IReadOnlyList<TaskDto>>>;

public class ListProjectTasksQueryHandler(IAppDbContext db)
    : IRequestHandler<ListProjectTasksQuery, Result<IReadOnlyList<TaskDto>>>
{
    // Whitelist sortable columns — never trust raw client input as an
    // ORDER BY expression.
    private static readonly Dictionary<string, Func<IQueryable<TaskEntity>, bool, IOrderedQueryable<TaskEntity>>> Sorters = new(StringComparer.OrdinalIgnoreCase)
    {
        ["priority_order"] = (q, desc) => desc ? q.OrderByDescending(t => t.PriorityOrder) : q.OrderBy(t => t.PriorityOrder),
        ["key"]            = (q, desc) => desc ? q.OrderByDescending(t => t.KeyNum) : q.OrderBy(t => t.KeyNum),
        ["title"]          = (q, desc) => desc ? q.OrderByDescending(t => t.Title) : q.OrderBy(t => t.Title),
        ["status"]         = (q, desc) => desc ? q.OrderByDescending(t => t.Status) : q.OrderBy(t => t.Status),
        ["priority"]       = (q, desc) => desc ? q.OrderByDescending(t => t.Priority) : q.OrderBy(t => t.Priority),
        ["story_points"]   = (q, desc) => desc ? q.OrderByDescending(t => t.StoryPoints) : q.OrderBy(t => t.StoryPoints),
        ["due_date"]       = (q, desc) => desc ? q.OrderByDescending(t => t.DueDate) : q.OrderBy(t => t.DueDate),
        ["created_at"]     = (q, desc) => desc ? q.OrderByDescending(t => t.CreatedAt) : q.OrderBy(t => t.CreatedAt),
        ["assignee"]       = (q, desc) => desc ? q.OrderByDescending(t => t.AssigneeId) : q.OrderBy(t => t.AssigneeId),
        ["epic"]           = (q, desc) => desc ? q.OrderByDescending(t => t.EpicId) : q.OrderBy(t => t.EpicId),
        ["sprint"]         = (q, desc) => desc ? q.OrderByDescending(t => t.SprintId) : q.OrderBy(t => t.SprintId),
    };

    public async Task<Result<IReadOnlyList<TaskDto>>> Handle(ListProjectTasksQuery request, CancellationToken ct)
    {
        var q = db.Tasks.Where(t => t.ProjectId == request.ProjectId);

        if (request.EpicId.HasValue) q = q.Where(t => t.EpicId == request.EpicId);
        if (request.SprintId.HasValue) q = q.Where(t => t.SprintId == request.SprintId);
        if (request.AssigneeId.HasValue) q = q.Where(t => t.AssigneeId == request.AssigneeId);
        if (!request.IncludeDone)
            q = q.Where(t => t.Status != DomainTaskStatus.Done && t.Status != DomainTaskStatus.WontDo);

        if (request.NoEpic == true) q = q.Where(t => t.EpicId == null);
        if (request.NoSprint == true) q = q.Where(t => t.SprintId == null);
        if (request.NoAssignee == true) q = q.Where(t => t.AssigneeId == null);

        if (request.Statuses is { Count: > 0 })
        {
            var parsed = ParseEnumList<DomainTaskStatus>(request.Statuses);
            if (parsed.Count > 0) q = q.Where(t => parsed.Contains(t.Status));
        }
        if (request.Priorities is { Count: > 0 })
        {
            var parsed = ParseEnumList<Domain.Enums.Priority>(request.Priorities);
            if (parsed.Count > 0) q = q.Where(t => parsed.Contains(t.Priority));
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            // ToLower + Contains avoids a Npgsql-specific call so the
            // Application layer doesn't take a hard dependency on the
            // provider; Postgres handles it with a lower(title) plan.
            var s = request.Search.Trim().ToLower();
            q = q.Where(t => t.Title.ToLower().Contains(s));
        }

        if (request.DueAfter is { } after) q = q.Where(t => t.DueDate >= after);
        if (request.DueBefore is { } before) q = q.Where(t => t.DueDate <= before);

        q = ApplySort(q, request.Sort);

        var tasks = await q.ToListAsync(ct);

        var projectKey = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => p.Key)
            .FirstOrDefaultAsync(ct) ?? "PR";

        return Result.Success<IReadOnlyList<TaskDto>>(
            tasks.Select(t => CreateTaskCommandHandler.ToDto(t, projectKey)).ToList());
    }

    // Sort syntax: "field" or "field:dir", comma-separated. Unknown fields
    // are skipped silently — keeps clients forward-compatible. Default sort
    // (priority_order, then created_at) kicks in if nothing valid was
    // supplied.
    private static IOrderedQueryable<TaskEntity> ApplySort(IQueryable<TaskEntity> q, string? sort)
    {
        if (string.IsNullOrWhiteSpace(sort))
            return q.OrderBy(t => t.PriorityOrder).ThenBy(t => t.CreatedAt);

        IOrderedQueryable<TaskEntity>? ordered = null;
        foreach (var token in sort.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var parts = token.Split(':');
            var field = parts[0];
            var desc = parts.Length > 1 && parts[1].Equals("desc", StringComparison.OrdinalIgnoreCase);
            if (!Sorters.TryGetValue(field, out var sorter)) continue;

            // First sort uses OrderBy via the sorter; subsequent sorts need
            // ThenBy, but our sorter table only knows OrderBy. Apply the
            // first one, then layer ThenBy by reusing the underlying field.
            ordered = ordered is null
                ? sorter(q, desc)
                : ChainThenBy(ordered, field, desc);
        }
        return ordered ?? q.OrderBy(t => t.PriorityOrder).ThenBy(t => t.CreatedAt);
    }

    private static IOrderedQueryable<TaskEntity> ChainThenBy(IOrderedQueryable<TaskEntity> q, string field, bool desc) => field.ToLowerInvariant() switch
    {
        "priority_order" => desc ? q.ThenByDescending(t => t.PriorityOrder) : q.ThenBy(t => t.PriorityOrder),
        "key"            => desc ? q.ThenByDescending(t => t.KeyNum) : q.ThenBy(t => t.KeyNum),
        "title"          => desc ? q.ThenByDescending(t => t.Title) : q.ThenBy(t => t.Title),
        "status"         => desc ? q.ThenByDescending(t => t.Status) : q.ThenBy(t => t.Status),
        "priority"       => desc ? q.ThenByDescending(t => t.Priority) : q.ThenBy(t => t.Priority),
        "story_points"   => desc ? q.ThenByDescending(t => t.StoryPoints) : q.ThenBy(t => t.StoryPoints),
        "due_date"       => desc ? q.ThenByDescending(t => t.DueDate) : q.ThenBy(t => t.DueDate),
        "created_at"     => desc ? q.ThenByDescending(t => t.CreatedAt) : q.ThenBy(t => t.CreatedAt),
        "assignee"       => desc ? q.ThenByDescending(t => t.AssigneeId) : q.ThenBy(t => t.AssigneeId),
        "epic"           => desc ? q.ThenByDescending(t => t.EpicId) : q.ThenBy(t => t.EpicId),
        "sprint"         => desc ? q.ThenByDescending(t => t.SprintId) : q.ThenBy(t => t.SprintId),
        _ => q
    };

    private static List<TEnum> ParseEnumList<TEnum>(IReadOnlyList<string> values) where TEnum : struct, Enum
    {
        var list = new List<TEnum>(values.Count);
        foreach (var v in values)
        {
            if (Enum.TryParse<TEnum>(v, ignoreCase: true, out var parsed))
                list.Add(parsed);
        }
        return list;
    }
}
