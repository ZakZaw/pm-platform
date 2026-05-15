using Domain.Enums;
using Domain.Exceptions;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Domain.ValueObjects;

/// <summary>
/// Enforces the task state machine described in CLAUDE.md / design doc 7.2:
///
///   Backlog -> ToDo -> InProgress -> InReview -> Done
///                      InProgress -> Blocked   -> InProgress
///                      InReview   -> InProgress (changes requested)
///                      Any active -> WontDo
///
/// Reopening Done back to InProgress is also allowed as a practical
/// affordance. Blocked and WontDo both require a reason.
/// </summary>
public static class TaskStatusTransition
{
    private static readonly Dictionary<DomainTaskStatus, HashSet<DomainTaskStatus>> Allowed = new()
    {
        [DomainTaskStatus.Backlog] = new() { DomainTaskStatus.ToDo, DomainTaskStatus.WontDo },
        [DomainTaskStatus.ToDo] = new() { DomainTaskStatus.InProgress, DomainTaskStatus.Backlog, DomainTaskStatus.WontDo },
        [DomainTaskStatus.InProgress] = new() { DomainTaskStatus.InReview, DomainTaskStatus.Blocked, DomainTaskStatus.WontDo },
        [DomainTaskStatus.InReview] = new() { DomainTaskStatus.Done, DomainTaskStatus.InProgress, DomainTaskStatus.WontDo },
        [DomainTaskStatus.Blocked] = new() { DomainTaskStatus.InProgress, DomainTaskStatus.WontDo },
        [DomainTaskStatus.Done] = new() { DomainTaskStatus.InProgress },
        [DomainTaskStatus.WontDo] = new() { DomainTaskStatus.Backlog }
    };

    public static bool IsAllowed(DomainTaskStatus from, DomainTaskStatus to)
        => from != to && Allowed.TryGetValue(from, out var next) && next.Contains(to);

    public static bool RequiresReason(DomainTaskStatus to)
        => to is DomainTaskStatus.Blocked or DomainTaskStatus.WontDo;

    public static void EnsureValid(DomainTaskStatus from, DomainTaskStatus to, string? reason)
    {
        if (from == to)
            throw new DomainException("Task.NoOpTransition", $"Task is already {from}.");
        if (!IsAllowed(from, to))
            throw new DomainException("Task.InvalidTransition", $"Cannot move a task from {from} to {to}.");
        if (RequiresReason(to) && string.IsNullOrWhiteSpace(reason))
            throw new DomainException("Task.ReasonRequired", $"Moving a task to {to} requires a reason.");
    }
}
