using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Processing;

/// <summary>
/// F2-22 — read the meeting's AI summary block. Any project member
/// can view; the action items live behind their own query.
/// </summary>
public record GetMeetingSummaryQuery(Guid MeetingId) : IRequest<Result<MeetingSummaryDto>>;

public class GetMeetingSummaryQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetMeetingSummaryQuery, Result<MeetingSummaryDto>>
{
    public async Task<Result<MeetingSummaryDto>> Handle(GetMeetingSummaryQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MeetingSummaryDto>(AuthErrors.NotAuthenticated);

        var meeting = await db.Meetings
            .FirstOrDefaultAsync(m => m.Id == request.MeetingId, ct);
        if (meeting is null)
            return Result.Failure<MeetingSummaryDto>(MeetingErrors.NotFound);

        var isMember = await db.ProjectMemberships
            .AnyAsync(m => m.ProjectId == meeting.ProjectId && m.UserId == userId, ct);
        if (!isMember)
            return Result.Failure<MeetingSummaryDto>(MeetingErrors.NotFound);

        return Result.Success(ProcessMeetingTranscriptCommandHandler.BuildSummary(meeting));
    }
}
