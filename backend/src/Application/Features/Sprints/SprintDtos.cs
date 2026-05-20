namespace Application.Features.Sprints;

public record SprintDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    DateTime StartDate,
    DateTime EndDate,
    DateTime? ActualStartDate,
    int? VelocityTarget,
    string Status,
    int? FinalVelocity,
    int TaskCount,
    int TotalPoints,
    int DonePoints,
    DateTime CreatedAt,
    DateTime? ClosedAt);

public record ScopeBaselineTask(Guid TaskId, string Title, int? StoryPoints);
