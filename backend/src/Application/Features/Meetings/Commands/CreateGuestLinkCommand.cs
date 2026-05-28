using System.Security.Cryptography;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Commands;

/// <summary>
/// F2-20 — generate a guest invite link. Organiser only. The token is
/// 32 url-safe characters from <see cref="RandomNumberGenerator"/>
/// (≈192 bits of entropy) so an attacker can't enumerate live links.
/// </summary>
public record CreateGuestLinkCommand(
    Guid MeetingId, string? GuestLabel, int? HoursValid)
    : IRequest<Result<MeetingGuestLinkDto>>;

public class CreateGuestLinkCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, GuestLinkUrlBuilder urls)
    : IRequestHandler<CreateGuestLinkCommand, Result<MeetingGuestLinkDto>>
{
    public const int DefaultHours = 24;
    public const int MaxHours = 24 * 14; // two weeks
    public const int TokenLength = 32;

    public async Task<Result<MeetingGuestLinkDto>> Handle(CreateGuestLinkCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MeetingGuestLinkDto>(AuthErrors.NotAuthenticated);

        var meeting = await db.Meetings
            .FirstOrDefaultAsync(m => m.Id == request.MeetingId, ct);
        if (meeting is null)
            return Result.Failure<MeetingGuestLinkDto>(MeetingErrors.NotFound);
        if (meeting.OrganizerId != userId)
            return Result.Failure<MeetingGuestLinkDto>(MeetingErrors.NotOrganiser);
        if (meeting.Status == Domain.Enums.MeetingStatus.Cancelled)
            return Result.Failure<MeetingGuestLinkDto>(MeetingErrors.AlreadyCancelled);

        var hours = Math.Clamp(request.HoursValid ?? DefaultHours, 1, MaxHours);
        var link = new MeetingGuestLink
        {
            MeetingId = meeting.Id,
            CreatedByUserId = userId,
            Token = NewToken(),
            GuestLabel = string.IsNullOrWhiteSpace(request.GuestLabel)
                ? null : request.GuestLabel.Trim(),
            ExpiresAt = DateTime.UtcNow.AddHours(hours),
        };
        db.MeetingGuestLinks.Add(link);
        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(link, urls));
    }

    internal static string NewToken()
    {
        // URL-safe base64 without padding so the token slots straight
        // into a path segment.
        var bytes = RandomNumberGenerator.GetBytes(24);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    internal static MeetingGuestLinkDto ToDto(MeetingGuestLink link, GuestLinkUrlBuilder urls) =>
        new(link.Id, link.MeetingId, link.Token, link.GuestLabel,
            link.CreatedAt, link.ExpiresAt, link.RevokedAt,
            urls.For(link.Token));
}

/// <summary>
/// Wraps the <c>Frontend:BaseUrl</c> setting so the command can render
/// a full guest URL without taking a direct dep on the host settings
/// type from Infrastructure.
/// </summary>
public class GuestLinkUrlBuilder(string baseUrl)
{
    public string For(string token) =>
        $"{baseUrl.TrimEnd('/')}/meetings/guest/{token}";
}
