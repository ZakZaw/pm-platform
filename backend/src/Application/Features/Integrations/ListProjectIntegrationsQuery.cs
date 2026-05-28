using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Integrations;

/// <summary>
/// F2-23 — list the source-control repos linked to a project. Any
/// project member can view; managing (connect / disconnect) is
/// PM-only.
/// </summary>
public record ListProjectIntegrationsQuery(Guid ProjectId)
    : IRequest<Result<IReadOnlyList<IntegrationDto>>>;

public class ListProjectIntegrationsQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<ListProjectIntegrationsQuery, Result<IReadOnlyList<IntegrationDto>>>
{
    public async Task<Result<IReadOnlyList<IntegrationDto>>> Handle(
        ListProjectIntegrationsQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<IReadOnlyList<IntegrationDto>>(AuthErrors.NotAuthenticated);

        var isMember = await db.ProjectMemberships
            .AnyAsync(m => m.ProjectId == request.ProjectId && m.UserId == userId, ct);
        if (!isMember)
            return Result.Failure<IReadOnlyList<IntegrationDto>>(ProjectErrors.NotFound);

        var items = await db.Integrations
            .Where(i => i.ProjectId == request.ProjectId)
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new
            {
                i.Id,
                i.ProjectId,
                Provider = i.Provider.ToString(),
                i.RepoFullName,
                i.WebhookId,
                ConnectedByName = i.ConnectedBy.FullName,
                i.CreatedAt,
                i.LastEventAt,
                Health = db.IntegrationHealth
                    .Where(h => h.IntegrationId == i.Id)
                    .Select(h => new { h.Status, h.LastCheckedAt, h.LastSyncedAt, h.ErrorMessage })
                    .FirstOrDefault(),
            })
            .ToListAsync(ct);

        var dtos = items
            .Select(i => new IntegrationDto(
                i.Id,
                i.ProjectId,
                i.Provider,
                i.RepoFullName,
                "https://github.com/" + i.RepoFullName,
                i.WebhookId != null,
                i.ConnectedByName,
                i.CreatedAt,
                i.LastEventAt,
                (i.Health?.Status ?? IntegrationHealthStatus.Unknown).ToString(),
                i.Health?.LastCheckedAt,
                i.Health?.LastSyncedAt,
                i.Health?.ErrorMessage))
            .ToList();

        return Result.Success<IReadOnlyList<IntegrationDto>>(dtos);
    }
}
