using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Organizations.Commands;

public record UpdateOrganizationCommand(string Slug, string Name) : IRequest<Result<OrganizationDto>>;

public class UpdateOrganizationCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateOrganizationCommand, Result<OrganizationDto>>
{
    public async Task<Result<OrganizationDto>> Handle(UpdateOrganizationCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<OrganizationDto>(AuthErrors.NotAuthenticated);

        var trimmedName = request.Name?.Trim() ?? string.Empty;
        if (trimmedName.Length < 2 || trimmedName.Length > 80)
            return Result.Failure<OrganizationDto>(OrgErrors.InvalidName);

        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Slug == request.Slug, ct);
        if (org is null)
            return Result.Failure<OrganizationDto>(OrgErrors.NotFound);

        var membership = await db.OrgMemberships
            .FirstOrDefaultAsync(m => m.OrganizationId == org.Id && m.UserId == userId, ct);

        if (membership is null)
            return Result.Failure<OrganizationDto>(OrgErrors.NotAMember);
        if (membership.Role is not (OrgRole.Owner or OrgRole.Admin))
            return Result.Failure<OrganizationDto>(OrgErrors.NotOwner);

        org.Name = trimmedName;

        await db.SaveChangesAsync(ct);

        return Result.Success(new OrganizationDto(
            org.Id, org.Name, org.Slug, org.LogoUrl, org.Plan.ToString(), org.SsoEnabled, org.CreatedAt));
    }
}
