namespace Application.Features.Sprints.Retrospective;

/// <summary>
/// What the retrospective page renders. The four narrative fields are
/// editable in-place; <see cref="NextSprintDraft"/> is read-only until
/// the PM clicks Apply (which uses it as the spec for a new sprint).
/// </summary>
public record SprintRetrospectiveDto(
    Guid Id,
    Guid SprintId,
    string Summary,
    string WhatWentWell,
    string WhatDidnt,
    string Suggestions,
    NextSprintDraftDto? NextSprintDraft,
    Guid GeneratedByUserId,
    DateTime GeneratedAt,
    Guid? AppliedByUserId,
    DateTime? AppliedAt,
    Guid? AppliedSprintId,
    string Provider,
    string Model);

public record NextSprintDraftDto(
    string Name,
    string? Goal,
    IReadOnlyList<NextSprintDraftPickDto> Tasks);

public record NextSprintDraftPickDto(
    Guid TaskId,
    string Key,
    string Title,
    int Points,
    string Reasoning);
