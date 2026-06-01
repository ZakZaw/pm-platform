namespace Application.Features.Analytics;

// ---- Org portfolio (F3-19, AN-09) ----
//
// One server-side aggregate for the org portfolio dashboard. Replaces the
// per-card N+1 client fetching the F1.5-08 portfolio page used: one call
// returns every (non-personal, non-archived) project rolled up with a
// type-agnostic health score and a type-appropriate headline metric, plus the
// cross-project resource-conflict list (people carrying open work in 2+
// projects) and an org-level rollup strip.

/// <summary>
/// One project as it appears on the portfolio. <see cref="Health"/> is the
/// type-agnostic <see cref="PortfolioHealthCalculator"/> score; <see
/// cref="HeadlineLabel"/>/<see cref="HeadlineValue"/> are the type-appropriate
/// headline (engineering: open tasks; sales: open pipeline value; support: open
/// tickets; marketing: open work; ops: open runs; generic: open tasks).
/// </summary>
public record PortfolioProjectDto(
    Guid Id,
    string Name,
    string Slug,
    string Key,
    string Type,
    int Health,
    string Band,
    string HeadlineLabel,
    string HeadlineValue,
    int OpenItems,
    int Overdue,
    int AtRisk);

/// <summary>One project a conflicted member is allocated to, with their open-item load there.</summary>
public record PortfolioAllocationDto(Guid ProjectId, string ProjectName, string ProjectType, int OpenItems);

/// <summary>
/// A member carrying open work across 2+ projects — the cross-project resource
/// conflict F3-19 surfaces. Ranked by project count then total open items.
/// </summary>
public record PortfolioResourceConflictDto(
    Guid UserId,
    string Name,
    string? AvatarUrl,
    int ProjectCount,
    int TotalOpenItems,
    IReadOnlyList<PortfolioAllocationDto> Allocations);

public record PortfolioTypeCountDto(string Type, int Count);

/// <summary>Org-level executive rollup strip across every project in the portfolio.</summary>
public record PortfolioRollupDto(
    int ProjectCount,
    int AtRiskCount,
    int TotalOpenItems,
    int TotalOverdue,
    IReadOnlyList<PortfolioTypeCountDto> ByType);

public record OrgPortfolioDto(
    PortfolioRollupDto Rollup,
    IReadOnlyList<PortfolioProjectDto> Projects,
    IReadOnlyList<PortfolioResourceConflictDto> ResourceConflicts);
