using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Dashboard.Queries;

public record GetDashboardLayoutQuery(Guid ProjectId) : IRequest<Result<DashboardLayoutDto>>;

public record DashboardLayoutDto(Guid ProjectId, string? LayoutJson, DateTime? UpdatedAt);

public class GetDashboardLayoutQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetDashboardLayoutQuery, Result<DashboardLayoutDto>>
{
    public async Task<Result<DashboardLayoutDto>> Handle(GetDashboardLayoutQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<DashboardLayoutDto>(AuthErrors.NotAuthenticated);

        var existing = await db.UserDashboardLayouts
            .Where(l => l.UserId == userId && l.ProjectId == request.ProjectId)
            .Select(l => new DashboardLayoutDto(l.ProjectId, l.LayoutJson, l.UpdatedAt))
            .FirstOrDefaultAsync(ct);

        // Returning null inside the DTO (rather than 404) lets the frontend
        // distinguish "no saved layout yet" from "project not found".
        return Result.Success(existing ?? new DashboardLayoutDto(request.ProjectId, null, null));
    }
}
