using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Users.Commands;

public record UpdateMyProfileCommand(
    string FullName,
    string Timezone,
    string[] SkillTags,
    int CapacityHoursPerWeek) : IRequest<Result<UserProfileDto>>;

public class UpdateMyProfileCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateMyProfileCommand, Result<UserProfileDto>>
{
    private const int MaxSkillTags = 20;
    private const int MaxSkillTagLength = 30;
    private const int MinFullNameLength = 2;
    private const int MaxFullNameLength = 120;
    private const int MaxCapacity = 168;

    public async Task<Result<UserProfileDto>> Handle(UpdateMyProfileCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<UserProfileDto>(AuthErrors.NotAuthenticated);

        var fullName = request.FullName?.Trim() ?? string.Empty;
        if (fullName.Length is < MinFullNameLength or > MaxFullNameLength)
            return Result.Failure<UserProfileDto>(UserErrors.InvalidFullName);

        if (!IsValidIanaTimezone(request.Timezone))
            return Result.Failure<UserProfileDto>(UserErrors.InvalidTimezone);

        if (request.CapacityHoursPerWeek is < 0 or > MaxCapacity)
            return Result.Failure<UserProfileDto>(UserErrors.InvalidCapacity);

        var normalisedTags = NormaliseSkillTags(request.SkillTags, out var tagError);
        if (tagError is not null)
            return Result.Failure<UserProfileDto>(tagError);

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return Result.Failure<UserProfileDto>(UserErrors.NotFound);

        user.FullName = fullName;
        user.Timezone = request.Timezone;
        user.SkillTags = normalisedTags;
        user.CapacityHoursPerWeek = request.CapacityHoursPerWeek;

        await db.SaveChangesAsync(ct);

        return Result.Success(new UserProfileDto(
            user.Id, user.Email, user.FullName, user.AvatarUrl,
            user.Timezone, user.SkillTags, user.CapacityHoursPerWeek));
    }

    private static bool IsValidIanaTimezone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return false;
        try
        {
            // .NET 10 + Npgsql + Linux all use IANA ids natively. On Windows,
            // FindSystemTimeZoneById accepts IANA ids when the time zone DB
            // is present (true on .NET 8+).
            _ = TimeZoneInfo.FindSystemTimeZoneById(id);
            return true;
        }
        catch (TimeZoneNotFoundException) { return false; }
        catch (InvalidTimeZoneException) { return false; }
    }

    // Lowercase + trim + drop empties + dedupe (case-insensitive, since we
    // lowercase first) + cap at 20 tags. Order preserved.
    private static string[] NormaliseSkillTags(string[]? raw, out Error? error)
    {
        error = null;
        if (raw is null || raw.Length == 0) return [];

        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<string>(raw.Length);
        foreach (var t in raw)
        {
            var tag = (t ?? string.Empty).Trim().ToLowerInvariant();
            if (tag.Length == 0) continue;
            if (tag.Length > MaxSkillTagLength)
            {
                error = UserErrors.InvalidSkillTag;
                return [];
            }
            if (seen.Add(tag)) result.Add(tag);
        }

        if (result.Count > MaxSkillTags)
        {
            error = UserErrors.TooManySkillTags;
            return [];
        }
        return result.ToArray();
    }
}
