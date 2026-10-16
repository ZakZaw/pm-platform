using Application.Common;
using Domain.Enums;

namespace Application.Authorization;

/// <summary>What the database says about a caller's relationship to a project.</summary>
public sealed record ProjectAccessFacts(
    bool IsPersonal,
    Guid? OwnerUserId,
    Guid? OrganizationId,
    bool HasActiveOrgMembership,
    ProjectRole? ProjectRole);

/// <summary>What the database says about a caller's relationship to an org.</summary>
public sealed record OrgAccessFacts(Guid OrganizationId, OrgRole? ActiveRole);

/// <summary>
/// Pure authorisation rules shared by the REST filters and the SignalR
/// hub. Kept free of EF so the rules are unit-testable on their own.
///
/// Rules:
/// <list type="bullet">
/// <item>Personal projects: only the owner (implicitly PM); never reachable
/// with an API key.</item>
/// <item>Org projects: the caller needs a project membership with at least
/// the required role AND an active (not removed) membership in the
/// project's org — removing someone from the org revokes project access
/// even if a stale project row survives.</item>
/// <item>API-key principals are confined to the key's org.</item>
/// </list>
/// Role enums are ordered most-privileged first (PM=0 … Viewer=3,
/// Owner=0 … Guest=3), so "at least X" means <c>(int)role &lt;= (int)X</c>.
/// </summary>
public static class AccessPolicy
{
    public static Result EvaluateProject(
        ProjectAccessFacts? facts, AccessPrincipal principal, ProjectRole minimum)
    {
        if (facts is null)
            return Result.Failure(ProjectErrors.NotFound);

        if (facts.IsPersonal)
        {
            if (principal.ApiKeyOrgId is not null || facts.OwnerUserId != principal.UserId)
                return Result.Failure(ProjectErrors.NotAMember);
            return Result.Success();
        }

        if (principal.ApiKeyOrgId is { } keyOrg && facts.OrganizationId != keyOrg)
            return Result.Failure(ProjectErrors.NotAMember);

        if (facts.ProjectRole is not { } role || !facts.HasActiveOrgMembership)
            return Result.Failure(ProjectErrors.NotAMember);

        return Satisfies(role, minimum)
            ? Result.Success()
            : Result.Failure(ProjectErrors.InsufficientProjectRole);
    }

    public static Result EvaluateOrg(
        OrgAccessFacts? facts, AccessPrincipal principal, OrgRole minimum)
    {
        if (facts is null)
            return Result.Failure(OrgErrors.NotFound);

        if (principal.ApiKeyOrgId is { } keyOrg && facts.OrganizationId != keyOrg)
            return Result.Failure(OrgErrors.NotAMember);

        if (facts.ActiveRole is not { } role)
            return Result.Failure(OrgErrors.NotAMember);

        return Satisfies(role, minimum)
            ? Result.Success()
            : Result.Failure(OrgErrors.InsufficientRole);
    }

    public static bool Satisfies(ProjectRole actual, ProjectRole minimum) => (int)actual <= (int)minimum;
    public static bool Satisfies(OrgRole actual, OrgRole minimum) => (int)actual <= (int)minimum;
}
