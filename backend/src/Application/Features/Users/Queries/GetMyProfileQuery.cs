using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Users.Queries;

public record GetMyProfileQuery : IRequest<Result<UserProfileDto>>;

public class GetMyProfileQueryHandler(
    IAppDbContext db,
    ICurrentUser currentUser)
    : IRequestHandler<GetMyProfileQuery, Result<UserProfileDto>>
{
    public async Task<Result<UserProfileDto>> Handle(GetMyProfileQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<UserProfileDto>(AuthErrors.NotAuthenticated);

        var user = await db.Users
            .Where(u => u.Id == userId)
            .Select(u => new UserProfileDto(
                u.Id,
                u.Email,
                u.FullName,
                u.AvatarUrl,
                u.Timezone,
                u.SkillTags,
                u.CapacityHoursPerWeek,
                u.OutOfOfficeUntil))
            .FirstOrDefaultAsync(ct);

        return user is null
            ? Result.Failure<UserProfileDto>(UserErrors.NotFound)
            : Result.Success(user);
    }
}
