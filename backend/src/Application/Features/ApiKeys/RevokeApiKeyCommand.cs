using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.ApiKeys;

/// <summary>F2-24 — revoke an API key (Owner/Admin only). Revoked keys
/// fail auth immediately; the row is kept for the audit trail.</summary>
public record RevokeApiKeyCommand(Guid ApiKeyId) : IRequest<Result>;

public class RevokeApiKeyCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<RevokeApiKeyCommand, Result>
{
    public async Task<Result> Handle(RevokeApiKeyCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var key = await db.ApiKeys.FirstOrDefaultAsync(k => k.Id == request.ApiKeyId, ct);
        if (key is null)
            return Result.Failure(ApiKeyErrors.NotFound);

        var role = await db.OrgMemberships
            .Where(m => m.OrganizationId == key.OrganizationId && m.UserId == userId && m.RemovedAt == null)
            .Select(m => (OrgRole?)m.Role)
            .FirstOrDefaultAsync(ct);
        if (role is null)
            return Result.Failure(ApiKeyErrors.NotFound);
        if (role is not (OrgRole.Owner or OrgRole.Admin))
            return Result.Failure(ApiKeyErrors.Forbidden);

        if (key.RevokedAt is not null)
            return Result.Failure(ApiKeyErrors.AlreadyRevoked);

        key.RevokedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
