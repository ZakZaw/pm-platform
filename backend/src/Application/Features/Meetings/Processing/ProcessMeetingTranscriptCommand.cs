using System.Text.Json;
using Application.Common;
using Application.Features.AI;
using Application.Features.Meetings.Transcripts;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Processing;

/// <summary>
/// F2-22 — run the post-meeting AI pass: take the accumulated
/// transcript, call <see cref="IAIService.ProcessMeetingTranscriptAsync"/>,
/// and persist the TL;DR + decisions / open questions / blockers on
/// the meeting plus draft <see cref="MeetingActionItem"/> rows. Runs
/// inside <see cref="FinaliseMeetingCommand"/> when a meeting moves to
/// <see cref="MeetingStatus.Completed"/>, and can be re-fired manually
/// from the summary page when the AI ought to re-read a longer
/// transcript.
///
/// Re-runs replace previous action-item drafts that haven't been
/// accepted or dismissed yet — accepted items stay so they keep
/// linking to their materialised task.
/// </summary>
public record ProcessMeetingTranscriptCommand(Guid MeetingId)
    : IRequest<Result<MeetingSummaryDto>>;

public class ProcessMeetingTranscriptCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IAIService ai)
    : IRequestHandler<ProcessMeetingTranscriptCommand, Result<MeetingSummaryDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<MeetingSummaryDto>> Handle(
        ProcessMeetingTranscriptCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MeetingSummaryDto>(AuthErrors.NotAuthenticated);

        if (!ai.IsConfigured)
            return Result.Failure<MeetingSummaryDto>(AIErrors.NotConfigured);

        var meeting = await db.Meetings
            .FirstOrDefaultAsync(m => m.Id == request.MeetingId, ct);
        if (meeting is null)
            return Result.Failure<MeetingSummaryDto>(MeetingErrors.NotFound);
        if (meeting.OrganizerId != userId)
            return Result.Failure<MeetingSummaryDto>(MeetingErrors.NotOrganiser);

        // Pull transcript segments out of the JSON column.
        var transcriptRow = await db.MeetingTranscripts
            .Where(t => t.MeetingId == meeting.Id)
            .Select(t => new { t.SegmentsJson, t.StartedAt })
            .FirstOrDefaultAsync(ct);
        var segments = transcriptRow is null
            ? new List<TranscriptSegmentDto>()
            : JsonSerializer.Deserialize<List<TranscriptSegmentDto>>(transcriptRow.SegmentsJson, JsonOpts)
              ?? new List<TranscriptSegmentDto>();
        if (segments.Count == 0)
            return Result.Failure<MeetingSummaryDto>(ActionItemErrors.EmptyTranscript);

        // Build the AI input. Attendees fold in the organiser so the
        // model can map "Aria will follow up" back to a user id.
        var attendeeRows = await db.MeetingAttendees
            .Where(a => a.MeetingId == meeting.Id)
            .Select(a => new { a.UserId, a.User.FullName })
            .ToListAsync(ct);
        var attendees = attendeeRows
            .Select(a => new AIMeetingAttendee(a.UserId, a.FullName))
            .ToList();
        var projectName = await db.Projects
            .Where(p => p.Id == meeting.ProjectId)
            .Select(p => p.Name)
            .FirstAsync(ct);

        var input = new AIMeetingProcessingInput(
            meeting.Title,
            meeting.Type.ToString(),
            transcriptRow?.StartedAt ?? meeting.ScheduledAt,
            projectName,
            attendees,
            segments.Select(s => new AIMeetingTranscriptSegment(s.DisplayName, s.Text)).ToList());

        AIMeetingProcessingResult result;
        try
        {
            result = await ai.ProcessMeetingTranscriptAsync(input, ct);
        }
        catch
        {
            return Result.Failure<MeetingSummaryDto>(AIErrors.ProviderFailed);
        }

        // Persist the summary on the meeting itself; the *Json columns
        // store small string arrays.
        meeting.SummaryMd = result.SummaryMd;
        meeting.DecisionsJson = JsonSerializer.Serialize(result.Decisions, JsonOpts);
        meeting.OpenQuestionsJson = JsonSerializer.Serialize(result.OpenQuestions, JsonOpts);
        meeting.BlockersJson = JsonSerializer.Serialize(result.Blockers, JsonOpts);
        meeting.ProcessedAt = DateTime.UtcNow;
        meeting.UpdatedAt = meeting.ProcessedAt.Value;

        // Wipe pending drafts (anything not accepted / dismissed) so a
        // re-run doesn't pile up duplicates. Accepted items keep
        // linking to their materialised task; dismissed ones stay
        // for the audit trail.
        var pendingDrafts = await db.MeetingActionItems
            .Where(a => a.MeetingId == meeting.Id
                     && a.AcceptedAt == null
                     && a.DismissedAt == null)
            .ToListAsync(ct);
        foreach (var d in pendingDrafts) db.MeetingActionItems.Remove(d);

        var attendeesByName = attendees
            .GroupBy(a => a.FullName, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().UserId, StringComparer.OrdinalIgnoreCase);

        var orderIndex = 0;
        foreach (var item in result.ActionItems)
        {
            Guid? ownerId = null;
            if (!string.IsNullOrWhiteSpace(item.OwnerFullName)
                && attendeesByName.TryGetValue(item.OwnerFullName, out var resolved))
            {
                ownerId = resolved;
            }
            var priority = ParsePriority(item.Priority);
            var dueDate = item.DueInDays is { } days
                ? (meeting.ScheduledAt.AddMinutes(meeting.DurationMinutes).Date.AddDays(days))
                : (DateTime?)null;

            db.MeetingActionItems.Add(new MeetingActionItem
            {
                MeetingId = meeting.Id,
                Title = item.Title,
                Description = item.Description,
                SuggestedOwnerUserId = ownerId,
                SuggestedDueDate = dueDate,
                SuggestedPriority = priority,
                OrderIndex = orderIndex++,
            });
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(BuildSummary(meeting));
    }

    internal static MeetingSummaryDto BuildSummary(Meeting meeting)
    {
        return new MeetingSummaryDto(
            meeting.Id,
            meeting.SummaryMd,
            ParseStrings(meeting.DecisionsJson),
            ParseStrings(meeting.OpenQuestionsJson),
            ParseStrings(meeting.BlockersJson),
            meeting.ProcessedAt);
    }

    private static IReadOnlyList<string> ParseStrings(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static Priority ParsePriority(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return Priority.Medium;
        return Enum.TryParse<Priority>(raw, ignoreCase: true, out var p) ? p : Priority.Medium;
    }
}
