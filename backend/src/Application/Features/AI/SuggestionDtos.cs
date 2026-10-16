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
    string Provider)
{
    /// <summary>F1.5-08 — inbox filter category derived from <see cref="Kind"/>
    /// (Sprint / Task / Team / Pipeline / SLA / Content / Runs / Other).</summary>
    public string Category => SuggestionInbox.CategoryFor(Kind);
}

/// <summary>A suggestion in the org-level inbox, with the project it came from.</summary>
public record OrgSuggestionDto(
    AISuggestionDto Suggestion,
    string ProjectName,
    string ProjectSlug);

/// <summary>All open suggestions from projects of one type.</summary>
public record SuggestionTypeGroupDto(
    string ProjectType,
    int Count,
    IReadOnlyList<OrgSuggestionDto> Suggestions);

/// <summary>
/// F1.5-08 — the org-level AI inbox: the union of every suggestion variant
/// across the projects the caller can see, grouped by project type.
/// </summary>
public record OrgSuggestionInboxDto(
    int Total,
    IReadOnlyList<SuggestionTypeGroupDto> Groups);
