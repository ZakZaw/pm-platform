namespace Domain.Enums;

/// <summary>
/// Lifecycle for a Marketing asset. Transitions are open from Draft up to
/// Approved; moving back from Review to Draft (rejection) requires a
/// reason — mirrors the Blocked/WontDo reason pattern from F1-09. Once
/// Published the asset is read-only except for an Archive transition.
/// </summary>
public enum AssetStatus
{
    Draft,
    Review,
    Approved,
    Published,
    Archived
}
