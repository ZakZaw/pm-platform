namespace Application.Features.AI;

public record AISuggestionDto(
    Guid Id,
    Guid ProjectId,
    /// <summary>F1.5-08 — the inbox uses this to colour/group cards by
    /// the originating project's type. Engineering / Sales / Support /
    /// Marketing / Operations / Generic.</summary>
    string ProjectType,
    string Kind,
    string Title,
    string? Body,
    string? PayloadJson,
    string Status,
    DateTime CreatedAt,
    DateTime? ActedAt,
    string Provider);
