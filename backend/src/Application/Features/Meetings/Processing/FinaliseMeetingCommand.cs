using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Processing;

/// <summary>
/// F2-22 — organiser-triggered "the meeting is over": stamps
/// <see cref="MeetingStatus.Completed"/>, locks the transcript, and
/// kicks off <see cref="ProcessMeetingTranscriptCommand"/> so the
/// summary + draft action items are ready within the AC's 2 min.
///
/// We chain the processing command rather than inlining the AI call
/// here so a re-run from the summary page reuses the same code path.
/// </summary>
public record FinaliseMeetingCommand(Guid MeetingId) : IRequest<Result<MeetingSummaryDto>>;

public class FinaliseMeetingCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IMediator mediator)
    : IRequestHandler<FinaliseMeetingCommand, Result<MeetingSummaryDto>>
{
    public async Task<Result<MeetingSummaryDto>> Handle(FinaliseMeetingCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MeetingSummaryDto>(AuthErrors.NotAuthenticated);

        var meeting = await db.Meetings
            .FirstOrDefaultAsync(m => m.Id == request.MeetingId, ct);
        if (meeting is null)
            return Result.Failure<MeetingSummaryDto>(MeetingErrors.NotFound);
        if (meeting.OrganizerId != userId)
            return Result.Failure<MeetingSummaryDto>(MeetingErrors.NotOrganiser);
        if (meeting.Status == MeetingStatus.Cancelled)
            return Result.Failure<MeetingSummaryDto>(MeetingErrors.AlreadyCancelled);

        if (meeting.Status != MeetingStatus.Completed)
        {
            meeting.Status = MeetingStatus.Completed;
            meeting.UpdatedAt = DateTime.UtcNow;

            // Lock the transcript so late SignalR segments don't trickle
            // in after the AI has run.
            var transcript = await db.MeetingTranscripts
                .FirstOrDefaultAsync(t => t.MeetingId == meeting.Id, ct);
            if (transcript is not null && transcript.FinalisedAt is null)
                transcript.FinalisedAt = meeting.UpdatedAt;

            await db.SaveChangesAsync(ct);
        }

        // Hand off to the processing command. If there's no transcript
        // yet we surface that error directly so the UI can prompt the
        // organiser to enable captions on the next run.
        return await mediator.Send(new ProcessMeetingTranscriptCommand(meeting.Id), ct);
    }
}
