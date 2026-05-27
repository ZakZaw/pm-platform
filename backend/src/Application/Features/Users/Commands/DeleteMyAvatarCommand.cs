using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Users.Commands;

public record DeleteMyAvatarCommand() : IRequest<Result<UserProfileDto>>;

public class DeleteMyAvatarCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteMyAvatarCommand, Result<UserProfileDto>>
{
    public async Task<Result<UserProfileDto>> Handle(DeleteMyAvatarCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<UserProfileDto>(AuthErrors.NotAuthenticated);

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return Result.Failure<UserProfileDto>(UserErrors.NotFound);

        user.AvatarUrl = null;
        await db.SaveChangesAsync(ct);

        return Result.Success(new UserProfileDto(
            user.Id, user.Email, user.FullName, user.AvatarUrl,
            user.Timezone, user.SkillTags, user.CapacityHoursPerWeek,
            user.OutOfOfficeUntil));
    }
}
