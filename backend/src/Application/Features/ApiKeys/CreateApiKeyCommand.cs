using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.ApiKeys;

/// <summary>
/// F2-24 — issue a new API key for an org (Owner/Admin only). The raw
/// secret is returned exactly once in <see cref="CreatedApiKeyDto.Secret"/>;
/// only its hash is stored. Requests later made with the key act as the
/// creating user.
/// </summary>
public record CreateApiKeyCommand(string OrgSlug, string Name, int? ExpiresInDays)
    : IRequest<Result<CreatedApiKeyDto>>;

public class CreateApiKeyCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<CreateApiKeyCommand, Result<CreatedApiKeyDto>>
{
    public async Task<Result<CreatedApiKeyDto>> Handle(CreateApiKeyCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<CreatedApiKeyDto>(AuthErrors.NotAuthenticated);

        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length is < 2 or > 120)
            return Result.Failure<CreatedApiKeyDto>(ApiKeyErrors.InvalidName);

        var org = await db.Organizations
            .Where(o => o.Slug == request.OrgSlug)
            .Select(o => new { o.Id })
            .FirstOrDefaultAsync(ct);
        if (org is null)
            return Result.Failure<CreatedApiKeyDto>(OrgErrors.NotFound);

        var role = await db.OrgMemberships
            .Where(m => m.OrganizationId == org.Id && m.UserId == userId && m.RemovedAt == null)
            .Select(m => (OrgRole?)m.Role)
            .FirstOrDefaultAsync(ct);
        if (role is null)
            return Result.Failure<CreatedApiKeyDto>(OrgErrors.NotFound);
        if (role is not (OrgRole.Owner or OrgRole.Admin))
            return Result.Failure<CreatedApiKeyDto>(ApiKeyErrors.Forbidden);

        var generated = ApiKeyGenerator.Generate();
        var entity = new ApiKey
        {
            OrganizationId = org.Id,
            Name = name,
            Prefix = generated.Prefix,
            KeyHash = generated.Hash,
            CreatedByUserId = userId,
            ExpiresAt = request.ExpiresInDays is { } d and > 0
                ? DateTime.UtcNow.AddDays(d)
                : null,
        };
        db.ApiKeys.Add(entity);
        await db.SaveChangesAsync(ct);

        var createdByName = await db.Users
            .Where(u => u.Id == userId).Select(u => u.FullName).FirstAsync(ct);

        var dto = new ApiKeyDto(
            entity.Id, entity.Name, entity.Prefix, createdByName,
            entity.CreatedAt, entity.LastUsedAt, entity.ExpiresAt, entity.RevokedAt,
            entity.IsActive(DateTime.UtcNow));
        return Result.Success(new CreatedApiKeyDto(dto, generated.Secret));
    }
}
