using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Commands;

/// <summary>
/// F2-19 — attendee RSVP. The caller must be on the invite list;
/// anyone else gets <see cref="MeetingErrors.NotAttendee"/>. Response
/// strings are case-insensitive so the API can accept lower-case from
/// the frontend.
/// </summary>
public record RespondToMeetingCommand(Guid MeetingId, string Response)
    : IRequest<Result<MeetingDetailDto>>;

public class RespondToMeetingCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<RespondToMeetingCommand, Result<MeetingDetailDto>>
{
    public async Task<Result<MeetingDetailDto>> Handle(RespondToMeetingCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MeetingDetailDto>(AuthErrors.NotAuthenticated);

        if (!Enum.TryParse<MeetingRsvp>(request.Response, ignoreCase: true, out var rsvp)
            || rsvp == MeetingRsvp.Pending)
            return Result.Failure<MeetingDetailDto>(MeetingErrors.NotAttendee);

        var attendee = await db.MeetingAttendees
            .FirstOrDefaultAsync(a => a.MeetingId == request.MeetingId && a.UserId == userId, ct);
        if (attendee is null)
            return Result.Failure<MeetingDetailDto>(MeetingErrors.NotAttendee);

        var meetingExists = await db.Meetings
            .AnyAsync(m => m.Id == request.MeetingId && m.Status != MeetingStatus.Cancelled, ct);
        if (!meetingExists)
            return Result.Failure<MeetingDetailDto>(MeetingErrors.NotFound);

        attendee.Response = rsvp;
        attendee.RespondedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var dto = await MeetingProjection.LoadDetailAsync(db, request.MeetingId, ct);
        return Result.Success(dto!);
    }
}
