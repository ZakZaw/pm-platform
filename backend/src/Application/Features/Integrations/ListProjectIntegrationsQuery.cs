using Application.Common;
using Application.Interfaces;
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
            .Select(i => new IntegrationDto(
                i.Id,
                i.ProjectId,
                i.Provider.ToString(),
                i.RepoFullName,
                "https://github.com/" + i.RepoFullName,
                i.WebhookId != null,
                i.ConnectedBy.FullName,
                i.CreatedAt,
                i.LastEventAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<IntegrationDto>>(items);
    }
}
