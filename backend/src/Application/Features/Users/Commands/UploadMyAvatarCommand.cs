using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Users.Commands;

public record UploadMyAvatarCommand(
    byte[] Bytes,
    string? ContentType,
    string? FileName) : IRequest<Result<UserProfileDto>>;

public class UploadMyAvatarCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IFileStorage fileStorage)
    : IRequestHandler<UploadMyAvatarCommand, Result<UserProfileDto>>
{
    private const int MaxBytes = 2 * 1024 * 1024;
    private static readonly HashSet<string> AllowedTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/png", "image/jpeg", "image/webp" };

    public async Task<Result<UserProfileDto>> Handle(UploadMyAvatarCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<UserProfileDto>(AuthErrors.NotAuthenticated);

        if (request.Bytes is null || request.Bytes.Length == 0)
            return Result.Failure<UserProfileDto>(UserErrors.AvatarInvalidType);
        if (request.Bytes.Length > MaxBytes)
            return Result.Failure<UserProfileDto>(UserErrors.AvatarTooLarge);
        if (string.IsNullOrEmpty(request.ContentType) || !AllowedTypes.Contains(request.ContentType))
            return Result.Failure<UserProfileDto>(UserErrors.AvatarInvalidType);

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return Result.Failure<UserProfileDto>(UserErrors.NotFound);

        var extension = ExtensionFor(request.ContentType);
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var stored = await fileStorage.SaveAsync(request.Bytes, "users", fileName, ct);

        user.AvatarUrl = stored.PublicUrl;
        await db.SaveChangesAsync(ct);

        return Result.Success(new UserProfileDto(
            user.Id, user.Email, user.FullName, user.AvatarUrl,
            user.Timezone, user.SkillTags, user.CapacityHoursPerWeek,
            user.OutOfOfficeUntil));
    }

    private static string ExtensionFor(string contentType) => contentType.ToLowerInvariant() switch
    {
        "image/png" => ".png",
        "image/jpeg" => ".jpg",
        "image/webp" => ".webp",
        _ => ".bin"
    };
}
