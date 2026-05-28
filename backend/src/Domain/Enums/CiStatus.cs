namespace Domain.Enums;

/// <summary>
/// F2-23 — rolled-up CI state for a task's linked PR, derived from
/// GitHub <c>check_run</c> / <c>status</c> events. <c>Pending</c> while
/// checks are queued or running; <c>Failure</c> drives the red badge
/// with a link to the run logs.
/// </summary>
public enum CiStatus
{
    Pending = 0,
    Success = 1,
    Failure = 2,
}
