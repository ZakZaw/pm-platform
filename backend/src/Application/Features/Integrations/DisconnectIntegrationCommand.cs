using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Integrations;

/// <summary>
/// F2-23 — disconnect a repo. Deletes the Integration row (PM-only) and
/// best-effort removes the registered GitHub webhook so we stop
/// receiving deliveries. Tasks keep their PR/CI badges — disconnecting
/// shouldn't rewrite history.
/// </summary>
public record DisconnectIntegrationCommand(Guid IntegrationId) : IRequest<Result>;

public class DisconnectIntegrationCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IGitHubService github)
    : IRequestHandler<DisconnectIntegrationCommand, Result>
{
    public async Task<Result> Handle(DisconnectIntegrationCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var integration = await db.Integrations
            .FirstOrDefaultAsync(i => i.Id == request.IntegrationId, ct);
        if (integration is null)
            return Result.Failure(IntegrationErrors.NotFound);

        var role = await db.ProjectMemberships
            .Where(m => m.ProjectId == integration.ProjectId && m.UserId == userId)
            .Select(m => (ProjectRole?)m.Role)
            .FirstOrDefaultAsync(ct);
        if (role is null)
            return Result.Failure(IntegrationErrors.NotFound);
        if (role != ProjectRole.PM)
            return Result.Failure(IntegrationErrors.Forbidden);

        if (integration.WebhookId is { } hookId && !string.IsNullOrWhiteSpace(integration.AccessToken))
        {
            await github.DeleteWebhookAsync(
                integration.RepoFullName, integration.AccessToken, hookId, ct);
        }

        db.Integrations.Remove(integration);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
