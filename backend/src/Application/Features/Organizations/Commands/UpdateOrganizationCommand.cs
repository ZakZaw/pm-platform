using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Organizations.Commands;

public record UpdateOrganizationCommand(string Slug, string Name) : IRequest<Result<OrganizationDto>>;

// Role check (Admin+) lives on the controller via [RequireOrgRole]. Handler
// only validates business rules and applies the mutation.
public class UpdateOrganizationCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateOrganizationCommand, Result<OrganizationDto>>
{
    public async Task<Result<OrganizationDto>> Handle(UpdateOrganizationCommand request, CancellationToken ct)
    {
        var trimmedName = request.Name?.Trim() ?? string.Empty;
        if (trimmedName.Length < 2 || trimmedName.Length > 80)
            return Result.Failure<OrganizationDto>(OrgErrors.InvalidName);

        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Slug == request.Slug, ct);
        if (org is null)
            return Result.Failure<OrganizationDto>(OrgErrors.NotFound);

        org.Name = trimmedName;

        await db.SaveChangesAsync(ct);

        return Result.Success(new OrganizationDto(
            org.Id, org.Name, org.Slug, org.LogoUrl, org.Plan.ToString(), org.SsoEnabled, org.CreatedAt));
    }
}
