using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Organizations.Commands;

public record SetOrgSsoCommand(string Slug, bool Enabled) : IRequest<Result<OrganizationDto>>;

public class SetOrgSsoCommandHandler(IAppDbContext db)
    : IRequestHandler<SetOrgSsoCommand, Result<OrganizationDto>>
{
    public async Task<Result<OrganizationDto>> Handle(SetOrgSsoCommand request, CancellationToken ct)
    {
        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Slug == request.Slug, ct);
        if (org is null) return Result.Failure<OrganizationDto>(OrgErrors.NotFound);

        org.SsoEnabled = request.Enabled;
        await db.SaveChangesAsync(ct);

        return Result.Success(new OrganizationDto(
            org.Id, org.Name, org.Slug, org.LogoUrl, org.Plan.ToString(), org.SsoEnabled, org.CreatedAt));
    }
}
