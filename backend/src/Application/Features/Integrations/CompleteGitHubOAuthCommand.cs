using System.Security.Cryptography;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Integrations;

/// <summary>
/// F2-23 — the GitHub OAuth callback. Verifies the signed state,
/// exchanges the code for an access token, creates the
/// <see cref="Integration"/> row, and best-effort registers the repo
/// webhook (signed with a freshly-generated per-integration secret).
///
/// Returns the project id so the controller can bounce the browser to
/// that project's settings page. The handler is intentionally tolerant
/// of webhook-registration failure — the row is still created so a dev
/// without a public callback URL can wire the hook up by hand.
/// </summary>
public record CompleteGitHubOAuthCommand(string? Code, string? State)
    : IRequest<Result<CompleteGitHubOAuthResult>>;

/// <summary>The project that was connected and the relative frontend
/// path the browser should be returned to.</summary>
public record CompleteGitHubOAuthResult(Guid ProjectId, string ReturnPath);

public class CompleteGitHubOAuthCommandHandler(
    IAppDbContext db, IGitHubService github, IOAuthStateProtector stateProtector)
    : IRequestHandler<CompleteGitHubOAuthCommand, Result<CompleteGitHubOAuthResult>>
{
    public async Task<Result<CompleteGitHubOAuthResult>> Handle(
        CompleteGitHubOAuthCommand request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            return Result.Failure<CompleteGitHubOAuthResult>(IntegrationErrors.TokenExchangeFailed);

        var state = stateProtector.Unprotect(request.State);
        if (state is null)
            return Result.Failure<CompleteGitHubOAuthResult>(IntegrationErrors.InvalidState);

        // Re-validate the caller's PM membership: the state proves who
        // started the flow, but their access could have changed since.
        var role = await db.ProjectMemberships
            .Where(m => m.ProjectId == state.ProjectId && m.UserId == state.UserId)
            .Select(m => (ProjectRole?)m.Role)
            .FirstOrDefaultAsync(ct);
        if (role != ProjectRole.PM)
            return Result.Failure<CompleteGitHubOAuthResult>(IntegrationErrors.Forbidden);

        // Guard the unique (provider, repo) — a racing connect or a repo
        // linked elsewhere between authorize and callback.
        var alreadyLinked = await db.Integrations.AnyAsync(
            i => i.Provider == GitProvider.GitHub && i.RepoFullName == state.Repo, ct);
        if (alreadyLinked)
            return Result.Failure<CompleteGitHubOAuthResult>(IntegrationErrors.RepoAlreadyLinked);

        var accessToken = await github.ExchangeCodeForTokenAsync(request.Code, ct);
        if (string.IsNullOrWhiteSpace(accessToken))
            return Result.Failure<CompleteGitHubOAuthResult>(IntegrationErrors.TokenExchangeFailed);

        var webhookSecret = GenerateSecret();
        var integration = new Integration
        {
            ProjectId = state.ProjectId,
            Provider = GitProvider.GitHub,
            RepoFullName = state.Repo,
            AccessToken = accessToken,
            WebhookSecret = webhookSecret,
            ConnectedByUserId = state.UserId,
        };

        // Best-effort hook registration — stamp the id when GitHub
        // accepted it so disconnect can remove the hook later.
        integration.WebhookId = await github.RegisterWebhookAsync(
            state.Repo, accessToken, webhookSecret, ct);

        db.Integrations.Add(integration);
        await db.SaveChangesAsync(ct);

        return Result.Success(new CompleteGitHubOAuthResult(state.ProjectId, state.ReturnPath));
    }

    // 32 random bytes, hex — well under the 100-char column and within
    // GitHub's webhook-secret length limit.
    private static string GenerateSecret() =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
}
