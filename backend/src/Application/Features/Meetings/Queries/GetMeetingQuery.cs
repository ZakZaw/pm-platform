using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Queries;

public record GetMeetingQuery(Guid MeetingId) : IRequest<Result<MeetingDetailDto>>;

public class GetMeetingQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetMeetingQuery, Result<MeetingDetailDto>>
{
    public async Task<Result<MeetingDetailDto>> Handle(GetMeetingQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MeetingDetailDto>(AuthErrors.NotAuthenticated);

        var meeting = await db.Meetings
            .Where(m => m.Id == request.MeetingId)
            .Select(m => new { m.Id, m.ProjectId })
            .FirstOrDefaultAsync(ct);
        if (meeting is null)
            return Result.Failure<MeetingDetailDto>(MeetingErrors.NotFound);

        // Anyone on the project can see the meeting. We don't gate on
        // attendee status — PMs want full visibility, and we'd rather
        // surface a meeting you're not on so you can ask to be added.
        var isMember = await db.ProjectMemberships
            .AnyAsync(m => m.ProjectId == meeting.ProjectId && m.UserId == userId, ct);
        if (!isMember)
            return Result.Failure<MeetingDetailDto>(MeetingErrors.NotFound);

        var dto = await MeetingProjection.LoadDetailAsync(db, meeting.Id, ct);
        return Result.Success(dto!);
    }
}
