namespace Application.Features.AI;

public record AISuggestionDto(
    Guid Id,
    Guid ProjectId,
    string Kind,
    string Title,
    string? Body,
    string? PayloadJson,
    string Status,
    DateTime CreatedAt,
    DateTime? ActedAt,
    string Provider);
