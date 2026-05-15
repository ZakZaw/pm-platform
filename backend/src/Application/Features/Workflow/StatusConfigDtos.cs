namespace Application.Features.Workflow;

public record StatusConfigDto(
    Guid Id,
    Guid ProjectId,
    string Status,
    string DisplayName,
    string Color,
    int OrderIndex,
    bool IsDoneState,
    bool IsVisible);
