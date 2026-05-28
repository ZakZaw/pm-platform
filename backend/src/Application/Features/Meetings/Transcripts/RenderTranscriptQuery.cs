using System.Globalization;
using System.Text;
using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Transcripts;

/// <summary>
/// F2-21 download path. Produces the .txt or .vtt representation of a
/// meeting's transcript — matching the AC's "Final transcript
/// downloadable as .txt or .vtt".
///
/// VTT is the canonical caption format; .txt drops the timing cues and
/// produces a clean human-readable transcript suitable for pasting
/// into a meeting note.
/// </summary>
public record RenderTranscriptQuery(Guid MeetingId, string Format)
    : IRequest<Result<RenderedTranscriptDto>>;

public record RenderedTranscriptDto(string FileName, string MimeType, string Body);

public class RenderTranscriptQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<RenderTranscriptQuery, Result<RenderedTranscriptDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<RenderedTranscriptDto>> Handle(
        RenderTranscriptQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<RenderedTranscriptDto>(AuthErrors.NotAuthenticated);

        var format = (request.Format ?? "txt").Trim().ToLowerInvariant();
        if (format is not ("txt" or "vtt"))
            return Result.Failure<RenderedTranscriptDto>(TranscriptErrors.InvalidFormat);

        var meeting = await db.Meetings
            .Where(m => m.Id == request.MeetingId)
            .Select(m => new { m.Id, m.ProjectId, m.Title, m.ScheduledAt })
            .FirstOrDefaultAsync(ct);
        if (meeting is null)
            return Result.Failure<RenderedTranscriptDto>(MeetingErrors.NotFound);

        var isMember = await db.ProjectMemberships
            .AnyAsync(m => m.ProjectId == meeting.ProjectId && m.UserId == userId, ct);
        if (!isMember)
            return Result.Failure<RenderedTranscriptDto>(MeetingErrors.NotFound);

        var row = await db.MeetingTranscripts
            .Where(t => t.MeetingId == request.MeetingId)
            .Select(t => new { t.SegmentsJson, t.StartedAt })
            .FirstOrDefaultAsync(ct);
        var segments = row is null
            ? new List<TranscriptSegmentDto>()
            : JsonSerializer.Deserialize<List<TranscriptSegmentDto>>(row.SegmentsJson, JsonOpts)
              ?? new List<TranscriptSegmentDto>();

        var origin = row?.StartedAt ?? meeting.ScheduledAt;
        var safeTitle = SafeName(meeting.Title);
        var body = format == "vtt"
            ? RenderVtt(segments, origin)
            : RenderTxt(segments);
        var mime = format == "vtt" ? "text/vtt" : "text/plain";
        var fileName = $"{safeTitle}.{format}";

        return Result.Success(new RenderedTranscriptDto(fileName, mime, body));
    }

    private static string RenderTxt(IReadOnlyList<TranscriptSegmentDto> segments)
    {
        if (segments.Count == 0) return "(no transcript)\n";
        var sb = new StringBuilder();
        string? lastSpeaker = null;
        foreach (var s in segments)
        {
            if (s.DisplayName != lastSpeaker)
            {
                if (lastSpeaker is not null) sb.AppendLine();
                sb.AppendLine($"[{s.StartedAt.ToLocalTime():HH:mm:ss}] {s.DisplayName}:");
                lastSpeaker = s.DisplayName;
            }
            sb.AppendLine($"  {s.Text}");
        }
        return sb.ToString();
    }

    private static string RenderVtt(IReadOnlyList<TranscriptSegmentDto> segments, DateTime origin)
    {
        var sb = new StringBuilder();
        sb.Append("WEBVTT\r\n\r\n");
        foreach (var s in segments)
        {
            sb.Append(VttTime(s.StartedAt - origin))
              .Append(" --> ")
              .Append(VttTime(s.EndedAt - origin))
              .Append("\r\n")
              .Append("<v ").Append(s.DisplayName).Append('>')
              .Append(EscapeCues(s.Text))
              .Append("\r\n\r\n");
        }
        return sb.ToString();
    }

    private static string VttTime(TimeSpan ts)
    {
        if (ts < TimeSpan.Zero) ts = TimeSpan.Zero;
        return ts.ToString(@"hh\:mm\:ss\.fff", CultureInfo.InvariantCulture);
    }

    private static string EscapeCues(string text) =>
        text.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");

    private static string SafeName(string title)
    {
        // Drop characters that fight a save-as dialog; collapse repeated
        // hyphens so we don't end up with "review----q3.txt".
        var trimmed = (title ?? "transcript").Trim();
        var safe = new StringBuilder(trimmed.Length);
        foreach (var ch in trimmed)
        {
            safe.Append(char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' ? ch : '-');
        }
        var compact = System.Text.RegularExpressions.Regex.Replace(safe.ToString(), "-+", "-").Trim('-');
        return string.IsNullOrEmpty(compact) ? "transcript" : compact;
    }
}
