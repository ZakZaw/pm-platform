using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Organizations.Commands;

public record CreateOrganizationCommand(
    string Name,
    byte[]? LogoBytes,
    string? LogoContentType,
    string? LogoFileName) : IRequest<Result<OrganizationDto>>;

public class CreateOrganizationCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IFileStorage fileStorage)
    : IRequestHandler<CreateOrganizationCommand, Result<OrganizationDto>>
{
    private const int MaxLogoBytes = 2 * 1024 * 1024;
    private static readonly HashSet<string> AllowedLogoTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/png", "image/jpeg", "image/webp" };

    public async Task<Result<OrganizationDto>> Handle(CreateOrganizationCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<OrganizationDto>(AuthErrors.NotAuthenticated);

        var trimmedName = request.Name?.Trim() ?? string.Empty;
        if (trimmedName.Length < 2 || trimmedName.Length > 80 || SlugGenerator.From(trimmedName).Length == 0)
            return Result.Failure<OrganizationDto>(OrgErrors.InvalidName);

        if (request.LogoBytes is { Length: > 0 } bytes)
        {
            if (bytes.Length > MaxLogoBytes)
                return Result.Failure<OrganizationDto>(OrgErrors.LogoTooLarge);
            if (string.IsNullOrEmpty(request.LogoContentType) || !AllowedLogoTypes.Contains(request.LogoContentType))
                return Result.Failure<OrganizationDto>(OrgErrors.LogoInvalidType);
        }

        var slug = await ResolveUniqueSlugAsync(SlugGenerator.From(trimmedName), ct);

        string? logoUrl = null;
        if (request.LogoBytes is { Length: > 0 } logoBytes)
        {
            var extension = ExtensionFor(request.LogoContentType!);
            var fileName = $"{Guid.NewGuid():N}{extension}";
            logoUrl = await fileStorage.SaveAsync(logoBytes, "orgs", fileName, ct);
        }

        var org = new Organization
        {
            Name = trimmedName,
            Slug = slug,
            LogoUrl = logoUrl,
            Plan = OrgPlan.Free
        };
        db.Organizations.Add(org);

        db.OrgMemberships.Add(new OrgMembership
        {
            OrganizationId = org.Id,
            UserId = userId,
            Role = OrgRole.Owner
        });

        await db.SaveChangesAsync(ct);

        return Result.Success(new OrganizationDto(
            org.Id, org.Name, org.Slug, org.LogoUrl, org.Plan.ToString(), org.SsoEnabled, org.CreatedAt));
    }

    private async Task<string> ResolveUniqueSlugAsync(string baseSlug, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(baseSlug)) baseSlug = "org";

        var slug = baseSlug;
        var suffix = 2;
        while (await db.Organizations.AnyAsync(o => o.Slug == slug, ct))
        {
            slug = $"{baseSlug}-{suffix++}";
            if (suffix > 1000) // pathological collision guard
                slug = $"{baseSlug}-{Guid.NewGuid():N}".Substring(0, Math.Min(baseSlug.Length + 9, 60));
        }
        return slug;
    }

    private static string ExtensionFor(string contentType) => contentType.ToLowerInvariant() switch
    {
        "image/png" => ".png",
        "image/jpeg" => ".jpg",
        "image/webp" => ".webp",
        _ => ".bin"
    };
}
