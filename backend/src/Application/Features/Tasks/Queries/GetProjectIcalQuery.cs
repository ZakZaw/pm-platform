using System.Globalization;
using System.Text;
using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Tasks.Queries;

/// <summary>
/// Renders the project's tasks (those with a due_date) as an RFC 5545
/// VCALENDAR. The frontend serves the bytes as text/calendar so calendar
/// clients can subscribe; UID = task.id so refreshes don't multiply events.
/// </summary>
public record GetProjectIcalQuery(Guid ProjectId, string BaseUrl) : IRequest<Result<string>>;

public class GetProjectIcalQueryHandler(IAppDbContext db)
    : IRequestHandler<GetProjectIcalQuery, Result<string>>
{
    public async Task<Result<string>> Handle(GetProjectIcalQuery request, CancellationToken ct)
    {
        var project = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => new { p.Id, p.Name, p.Slug, p.Key, p.OrganizationId })
            .FirstOrDefaultAsync(ct);
        if (project is null) return Result.Failure<string>(ProjectErrors.NotFound);

        var orgSlug = project.OrganizationId is { } orgId
            ? await db.Organizations.Where(o => o.Id == orgId).Select(o => o.Slug).FirstAsync(ct)
            : "personal";

        var tasks = await db.Tasks
            .Where(t => t.ProjectId == request.ProjectId && t.DueDate != null)
            .OrderBy(t => t.DueDate)
            .Select(t => new
            {
                t.Id, t.KeyNum, t.Title, t.Description,
                Status = t.Status.ToString(),
                Priority = t.Priority.ToString(),
                t.DueDate
            })
            .ToListAsync(ct);

        var ical = BuildIcal(project.Name, project.Key, orgSlug, project.Slug, request.BaseUrl, tasks);
        return Result.Success(ical);
    }

    private static string BuildIcal(string projectName, string projectKey, string orgSlug, string projectSlug, string baseUrl, IEnumerable<dynamic> tasks)
    {
        var now = DateTime.UtcNow;
        var sb = new StringBuilder();
        sb.Append("BEGIN:VCALENDAR\r\n");
        sb.Append("VERSION:2.0\r\n");
        sb.Append("PRODID:-//PM Platform//Project Calendar//EN\r\n");
        sb.Append("CALSCALE:GREGORIAN\r\n");
        sb.Append("METHOD:PUBLISH\r\n");
        sb.Append($"X-WR-CALNAME:{EscapeText(projectName)} – Tasks\r\n");
        sb.Append($"X-WR-CALDESC:Tasks with due dates for {EscapeText(projectName)}\r\n");

        foreach (var t in tasks)
        {
            DateOnly due = DateOnly.FromDateTime(((DateTime)t.DueDate).ToUniversalTime());
            sb.Append("BEGIN:VEVENT\r\n");
            sb.Append($"UID:task-{t.Id:N}@pm-platform\r\n");
            sb.Append($"DTSTAMP:{now:yyyyMMddTHHmmssZ}\r\n");
            // All-day events use VALUE=DATE per RFC 5545 §3.6.1; DTEND is the
            // day after for a one-day all-day event.
            sb.Append($"DTSTART;VALUE=DATE:{due:yyyyMMdd}\r\n");
            sb.Append($"DTEND;VALUE=DATE:{due.AddDays(1):yyyyMMdd}\r\n");
            sb.Append($"SUMMARY:{EscapeText($"[{projectKey}-{t.KeyNum}] {t.Title}")}\r\n");

            var url = $"{baseUrl.TrimEnd('/')}/{orgSlug}/projects/{projectSlug}/board?task={t.Id}";
            sb.Append($"URL:{url}\r\n");

            var description = string.IsNullOrWhiteSpace((string?)t.Description)
                ? $"Status: {t.Status} · Priority: {t.Priority}"
                : $"Status: {t.Status} · Priority: {t.Priority}\\n\\n{EscapeText((string)t.Description)}";
            sb.Append("DESCRIPTION:");
            sb.Append(FoldLine(description));
            sb.Append("\r\n");

            sb.Append("END:VEVENT\r\n");
        }

        sb.Append("END:VCALENDAR\r\n");
        return sb.ToString();
    }

    // Per RFC 5545 §3.3.11 — escape commas, semicolons, backslashes, newlines.
    private static string EscapeText(string s) =>
        s.Replace("\\", "\\\\")
         .Replace(";", "\\;")
         .Replace(",", "\\,")
         .Replace("\r\n", "\\n")
         .Replace("\n", "\\n");

    // Long content lines must be folded at 75 octets with a CRLF + space
    // continuation. Splits on Unicode boundaries are good enough for ASCII
    // task descriptions; non-ASCII would need byte-aware splitting.
    private static string FoldLine(string s)
    {
        const int limit = 73;
        if (s.Length <= limit) return s;
        var sb = new StringBuilder(s.Length + (s.Length / limit) * 3);
        for (int i = 0; i < s.Length; i += limit)
        {
            if (i > 0) sb.Append("\r\n ");
            sb.Append(s.AsSpan(i, Math.Min(limit, s.Length - i)));
        }
        return sb.ToString();
    }
}
