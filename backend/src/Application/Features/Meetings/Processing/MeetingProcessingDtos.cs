namespace Application.Features.Meetings.Processing;

/// <summary>
/// F2-22 — flattened post-meeting AI artefacts. Lists are simple
/// strings (decisions, open questions, blockers) so the UI can render
/// them as bullet lists without extra schema.
/// </summary>
public record MeetingSummaryDto(
    Guid MeetingId,
    string? SummaryMd,
    IReadOnlyList<string> Decisions,
    IReadOnlyList<string> OpenQuestions,
    IReadOnlyList<string> Blockers,
    DateTime? ProcessedAt);

public record MeetingActionItemDto(
    Guid Id,
    Guid MeetingId,
    string Title,
    string? Description,
    Guid? SuggestedOwnerUserId,
    string? SuggestedOwnerFullName,
    DateTime? SuggestedDueDate,
    string SuggestedPriority,
    int OrderIndex,
    DateTime? AcceptedAt,
    Guid? AcceptedTaskId,
    DateTime? DismissedAt);
