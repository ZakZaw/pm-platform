using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Roadmap.Commands;

/// <summary>
/// Move an epic's roadmap dates. When <paramref name="Cascade"/> is false
/// (the default) and at least one dependent would shift, the handler returns
/// the proposed shifts without writing — the frontend opens a confirm modal
/// and re-PATCHes with <c>cascade=true</c> to apply.
/// </summary>
public record UpdateEpicDatesCommand(
    Guid EpicId,
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool Cascade)
    : IRequest<Result<EpicDatesUpdateResult>>;

public record EpicDatesUpdateResult(
    bool Applied,
    IReadOnlyList<CascadeShiftDto> Affected);

public record CascadeShiftDto(
    Guid EpicId,
    string Title,
    DateOnly NewStartDate,
    DateOnly NewEndDate);

public class UpdateEpicDatesCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IActivityRecorder activity,
    IProjectEventBus events)
    : IRequestHandler<UpdateEpicDatesCommand, Result<EpicDatesUpdateResult>>
{
    public async Task<Result<EpicDatesUpdateResult>> Handle(
        UpdateEpicDatesCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<EpicDatesUpdateResult>(AuthErrors.NotAuthenticated);

        var epic = await db.Epics.FirstOrDefaultAsync(e => e.Id == request.EpicId, ct);
        if (epic is null)
            return Result.Failure<EpicDatesUpdateResult>(EpicErrors.NotFound);

        if (request.StartDate is { } s && request.EndDate is { } e && e < s)
            return Result.Failure<EpicDatesUpdateResult>(EpicErrors.InvalidDateRange);

        var oldEnd = epic.EndDate;
        var newEnd = request.EndDate;

        // Cascade only applies when the new end pushes later than the old
        // end. New dates, narrower windows, and start-only moves never
        // displace downstream work.
        var needsCascadeWalk = oldEnd is { } o && newEnd is { } n && n > o;
        var shifts = new Dictionary<Guid, (DateOnly NewStart, DateOnly NewEnd, string Title)>();

        if (needsCascadeWalk)
        {
            shifts = await ComputeDependentShifts(epic, oldEnd!.Value, newEnd!.Value, ct);
        }

        if (!request.Cascade && shifts.Count > 0)
        {
            var preview = shifts.Select(kv => new CascadeShiftDto(
                kv.Key, kv.Value.Title, kv.Value.NewStart, kv.Value.NewEnd)).ToList();
            return Result.Success(new EpicDatesUpdateResult(Applied: false, Affected: preview));
        }

        var oldStart = epic.StartDate;
        epic.StartDate = request.StartDate;
        epic.EndDate = request.EndDate;

        foreach (var (id, shift) in shifts)
        {
            var dep = await db.Epics.FirstAsync(x => x.Id == id, ct);
            dep.StartDate = shift.NewStart;
            dep.EndDate = shift.NewEnd;
        }

        activity.Record(
            orgId: await OrgIdFor(epic.ProjectId, ct),
            projectId: epic.ProjectId,
            actorId: userId,
            verb: ActivityVerb.EpicDatesChanged,
            targetType: "Epic",
            targetId: epic.Id,
            summary: $"moved {epic.Title} to {Fmt(epic.StartDate)} – {Fmt(epic.EndDate)}",
            metadata: new
            {
                from = new { start = oldStart, end = oldEnd },
                to = new { start = epic.StartDate, end = epic.EndDate },
                cascaded = shifts.Count
            });

        await db.SaveChangesAsync(ct);

        await events.PublishAsync(epic.ProjectId, ProjectEvents.EpicDatesChanged, new
        {
            epicId = epic.Id,
            startDate = epic.StartDate,
            endDate = epic.EndDate,
            cascadedEpicIds = shifts.Keys.ToArray(),
        }, ct);

        var affected = shifts.Select(kv => new CascadeShiftDto(
            kv.Key, kv.Value.Title, kv.Value.NewStart, kv.Value.NewEnd)).ToList();
        return Result.Success(new EpicDatesUpdateResult(Applied: true, Affected: affected));
    }

    /// <summary>
    /// BFS the reverse dependency graph from the moved epic. For each
    /// downstream epic, compute the date its prerequisites finish (taking
    /// any already-computed shifts into account) and push the epic forward
    /// only if its current start would land before that.
    /// </summary>
    private async Task<Dictionary<Guid, (DateOnly NewStart, DateOnly NewEnd, string Title)>> ComputeDependentShifts(
        Epic moved, DateOnly oldEnd, DateOnly newEnd, CancellationToken ct)
    {
        // Single dependency-edges fetch for the whole project — avoids N+1.
        var allEdges = await db.EpicDependencies
            .Where(d => d.Epic.ProjectId == moved.ProjectId)
            .Select(d => new { d.EpicId, d.DependsOnEpicId })
            .ToListAsync(ct);

        var allEpics = await db.Epics
            .Where(e => e.ProjectId == moved.ProjectId)
            .Select(e => new { e.Id, e.Title, e.StartDate, e.EndDate })
            .ToDictionaryAsync(e => e.Id, ct);

        // child -> list of parents (the epics it depends on)
        var parentsOf = allEdges
            .GroupBy(e => e.EpicId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.DependsOnEpicId).ToList());

        // parent -> list of children (the epics that depend on it)
        var childrenOf = allEdges
            .GroupBy(e => e.DependsOnEpicId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.EpicId).ToList());

        var shifts = new Dictionary<Guid, (DateOnly NewStart, DateOnly NewEnd, string Title)>();
        // The "current" end-date function: returns the shifted value if we've
        // moved the epic in this walk, the new end for the originally-moved
        // epic, or the unmodified value otherwise.
        DateOnly? EndOf(Guid id)
        {
            if (id == moved.Id) return newEnd;
            if (shifts.TryGetValue(id, out var s)) return s.NewEnd;
            return allEpics.TryGetValue(id, out var e) ? e.EndDate : null;
        }

        // BFS in topological-ish order. Re-enqueue children when we shift
        // them so their own children re-evaluate against the new end.
        var queue = new Queue<Guid>();
        if (childrenOf.TryGetValue(moved.Id, out var firstChildren))
            foreach (var c in firstChildren) queue.Enqueue(c);

        while (queue.Count > 0)
        {
            var childId = queue.Dequeue();
            if (!allEpics.TryGetValue(childId, out var child)) continue;
            if (child.StartDate is null || child.EndDate is null) continue;

            // Latest end among all the child's prerequisites (after upstream
            // shifts). If null, the child has no useful constraint.
            DateOnly? latestPrereqEnd = null;
            if (parentsOf.TryGetValue(childId, out var parents))
            {
                foreach (var p in parents)
                {
                    if (EndOf(p) is { } pEnd && (latestPrereqEnd is null || pEnd > latestPrereqEnd))
                        latestPrereqEnd = pEnd;
                }
            }
            if (latestPrereqEnd is null) continue;

            var currentStart = shifts.TryGetValue(childId, out var existing)
                ? existing.NewStart
                : child.StartDate.Value;

            if (currentStart >= latestPrereqEnd.Value) continue; // no overlap, no push

            var delta = latestPrereqEnd.Value.DayNumber - currentStart.DayNumber;
            var currentEnd = shifts.TryGetValue(childId, out var existing2)
                ? existing2.NewEnd
                : child.EndDate.Value;

            var newChildStart = currentStart.AddDays(delta);
            var newChildEnd = currentEnd.AddDays(delta);
            shifts[childId] = (newChildStart, newChildEnd, child.Title);

            if (childrenOf.TryGetValue(childId, out var grandchildren))
                foreach (var g in grandchildren) queue.Enqueue(g);
        }

        return shifts;
    }

    private async Task<Guid?> OrgIdFor(Guid projectId, CancellationToken ct) =>
        await db.Projects.Where(p => p.Id == projectId)
            .Select(p => p.OrganizationId)
            .FirstAsync(ct);

    private static string Fmt(DateOnly? d) => d?.ToString("yyyy-MM-dd") ?? "—";
}
