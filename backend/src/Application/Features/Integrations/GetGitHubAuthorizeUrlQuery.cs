using System.Text.RegularExpressions;
using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Integrations;

/// <summary>
/// F2-23 — start the GitHub OAuth flow for a project. Validates the
/// caller is a PM and the repo slug is well-formed, then hands back the
/// authorize URL (with a signed state that round-trips the project /
/// repo / user into the callback). No DB write happens here — the
/// Integration row is created by <see cref="CompleteGitHubOAuthCommand"/>.
/// </summary>
public record GetGitHubAuthorizeUrlQuery(Guid ProjectId, string Repo, string? ReturnPath)
    : IRequest<Result<GitHubAuthorizeDto>>;

public partial class GetGitHubAuthorizeUrlQueryHandler(
    IAppDbContext db, ICurrentUser currentUser, IGitHubService github, IOAuthStateProtector state)
    : IRequestHandler<GetGitHubAuthorizeUrlQuery, Result<GitHubAuthorizeDto>>
{
    [GeneratedRegex(@"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", RegexOptions.Compiled)]
    private static partial Regex RepoRegex();

    public async Task<Result<GitHubAuthorizeDto>> Handle(
        GetGitHubAuthorizeUrlQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<GitHubAuthorizeDto>(AuthErrors.NotAuthenticated);

        if (!github.IsConfigured)
            return Result.Failure<GitHubAuthorizeDto>(IntegrationErrors.NotConfigured);

        var repo = (request.Repo ?? string.Empty).Trim();
        if (!RepoRegex().IsMatch(repo))
            return Result.Failure<GitHubAuthorizeDto>(IntegrationErrors.InvalidRepo);

        var role = await db.ProjectMemberships
            .Where(m => m.ProjectId == request.ProjectId && m.UserId == userId)
            .Select(m => (ProjectRole?)m.Role)
            .FirstOrDefaultAsync(ct);
        if (role is null)
            return Result.Failure<GitHubAuthorizeDto>(ProjectErrors.NotFound);
        if (role != ProjectRole.PM)
            return Result.Failure<GitHubAuthorizeDto>(IntegrationErrors.Forbidden);

        // Reject early if the repo is already linked anywhere — saves the
        // user a pointless GitHub round-trip.
        var alreadyLinked = await db.Integrations.AnyAsync(
            i => i.Provider == GitProvider.GitHub && i.RepoFullName == repo, ct);
        if (alreadyLinked)
            return Result.Failure<GitHubAuthorizeDto>(IntegrationErrors.RepoAlreadyLinked);

        // Only relative paths round-trip — guards the callback redirect
        // against open-redirect to an external host.
        var returnPath = SanitizeReturnPath(request.ReturnPath);
        var token = state.Protect(new OAuthState(request.ProjectId, repo, userId, returnPath));
        var url = github.BuildAuthorizeUrl(token);
        return Result.Success(new GitHubAuthorizeDto(url));
    }

    // Accept only same-site absolute paths ("/a/b"); anything else
    // (external URL, protocol-relative "//evil") falls back to root.
    internal static string SanitizeReturnPath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return "/";
        if (!path.StartsWith('/') || path.StartsWith("//", StringComparison.Ordinal)) return "/";
        return path.Length > 500 ? "/" : path;
    }
}
