using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Organizations.Queries;

public record GetOrganizationBySlugQuery(string Slug) : IRequest<Result<OrganizationDto>>;

// Membership/role check (Member+) lives on the controller via
// [RequireOrgRole]. Handler just loads the row.
public class GetOrganizationBySlugQueryHandler(IAppDbContext db)
    : IRequestHandler<GetOrganizationBySlugQuery, Result<OrganizationDto>>
{
    public async Task<Result<OrganizationDto>> Handle(GetOrganizationBySlugQuery request, CancellationToken ct)
    {
        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Slug == request.Slug, ct);
        if (org is null)
            return Result.Failure<OrganizationDto>(OrgErrors.NotFound);

        return Result.Success(new OrganizationDto(
            org.Id, org.Name, org.Slug, org.LogoUrl, org.Plan.ToString(), org.SsoEnabled, org.CreatedAt));
    }
}
