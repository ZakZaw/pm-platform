using Domain.Enums;
using Domain.Exceptions;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Domain.ValueObjects;

/// <summary>
/// Task status transitions are unrestricted: any status can move to any
/// other status. The rigid state machine from the original design doc
/// was lifted (2026-05-18) — teams use the board however they want and
/// the explicit constraint just got in the way.
///
/// Two rules remain:
///   • No-op transitions (from == to) are rejected.
///   • Moving to Blocked or WontDo still requires a reason — that's a
///     useful audit signal, not a transition rule.
/// </summary>
public static class TaskStatusTransition
{
    public static bool IsAllowed(DomainTaskStatus from, DomainTaskStatus to) => from != to;

    public static bool RequiresReason(DomainTaskStatus to)
        => to is DomainTaskStatus.Blocked or DomainTaskStatus.WontDo;

    public static void EnsureValid(DomainTaskStatus from, DomainTaskStatus to, string? reason)
    {
        if (from == to)
            throw new DomainException("Task.NoOpTransition", $"Task is already {from}.");
        if (RequiresReason(to) && string.IsNullOrWhiteSpace(reason))
            throw new DomainException("Task.ReasonRequired", $"Moving a task to {to} requires a reason.");
    }
}
