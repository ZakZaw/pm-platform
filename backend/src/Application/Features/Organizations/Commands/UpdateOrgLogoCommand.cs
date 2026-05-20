using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Organizations.Commands;

public record UpdateOrgLogoCommand(
    string Slug,
    byte[] LogoBytes,
    string LogoContentType,
    string LogoFileName) : IRequest<Result<OrganizationDto>>;

public class UpdateOrgLogoCommandHandler(IAppDbContext db, IFileStorage fileStorage)
    : IRequestHandler<UpdateOrgLogoCommand, Result<OrganizationDto>>
{
    private const int MaxLogoBytes = 2 * 1024 * 1024;
    private static readonly HashSet<string> AllowedLogoTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/png", "image/jpeg", "image/webp" };

    public async Task<Result<OrganizationDto>> Handle(UpdateOrgLogoCommand request, CancellationToken ct)
    {
        if (request.LogoBytes is null || request.LogoBytes.Length == 0)
            return Result.Failure<OrganizationDto>(OrgErrors.LogoInvalidType);
        if (request.LogoBytes.Length > MaxLogoBytes)
            return Result.Failure<OrganizationDto>(OrgErrors.LogoTooLarge);
        if (string.IsNullOrEmpty(request.LogoContentType) || !AllowedLogoTypes.Contains(request.LogoContentType))
            return Result.Failure<OrganizationDto>(OrgErrors.LogoInvalidType);

        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Slug == request.Slug, ct);
        if (org is null)
            return Result.Failure<OrganizationDto>(OrgErrors.NotFound);

        var extension = ExtensionFor(request.LogoContentType);
        var fileName = $"{Guid.NewGuid():N}{extension}";
        org.LogoUrl = await fileStorage.SaveAsync(request.LogoBytes, "orgs", fileName, ct);

        await db.SaveChangesAsync(ct);

        return Result.Success(new OrganizationDto(
            org.Id, org.Name, org.Slug, org.LogoUrl, org.Plan.ToString(), org.SsoEnabled, org.CreatedAt));
    }

    private static string ExtensionFor(string contentType) => contentType.ToLowerInvariant() switch
    {
        "image/png" => ".png",
        "image/jpeg" => ".jpg",
        "image/webp" => ".webp",
        _ => ".bin"
    };
}
