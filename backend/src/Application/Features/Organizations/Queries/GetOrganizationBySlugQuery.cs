using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Organizations.Queries;

public record GetOrganizationBySlugQuery(string Slug) : IRequest<Result<OrganizationDto>>;

public class GetOrganizationBySlugQueryHandler(
    IAppDbContext db,
    ICurrentUser currentUser)
    : IRequestHandler<GetOrganizationBySlugQuery, Result<OrganizationDto>>
{
    public async Task<Result<OrganizationDto>> Handle(GetOrganizationBySlugQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<OrganizationDto>(AuthErrors.NotAuthenticated);

        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Slug == request.Slug, ct);
        if (org is null)
            return Result.Failure<OrganizationDto>(OrgErrors.NotFound);

        var isMember = await db.OrgMemberships
            .AnyAsync(m => m.OrganizationId == org.Id && m.UserId == userId, ct);
        if (!isMember)
            return Result.Failure<OrganizationDto>(OrgErrors.NotAMember);

        return Result.Success(new OrganizationDto(
            org.Id, org.Name, org.Slug, org.LogoUrl, org.Plan.ToString(), org.SsoEnabled, org.CreatedAt));
    }
}
