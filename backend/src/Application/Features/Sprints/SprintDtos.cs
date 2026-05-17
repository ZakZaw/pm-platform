namespace Application.Features.Sprints;

public record SprintDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    string? Goal,
    DateTime StartDate,
    DateTime EndDate,
    int? VelocityTarget,
    string Status,
    int? FinalVelocity,
    int TaskCount,
    int TotalPoints,
    int DonePoints,
    DateTime CreatedAt,
    DateTime? ClosedAt);

public record ScopeBaselineTask(Guid TaskId, string Title, int? StoryPoints);
