using System.Globalization;
using System.Text;

namespace Application.Features.Meetings;

/// <summary>
/// Tiny RFC 5545 VEVENT writer scoped to F2-19. We deliberately don't
/// drag in iCal.NET — every meeting writes the same handful of
/// properties (UID, DTSTAMP, DTSTART, DTEND, SUMMARY, DESCRIPTION,
/// ORGANIZER, ATTENDEE*, RRULE?) so a 60-line builder is enough and
/// keeps the dependency surface small.
///
/// CRLF line endings and the 75-octet content-line fold are mandated
/// by the spec; calendar clients reject quietly when either is missing.
/// </summary>
public sealed class IcsCalendarWriter
{
    private const string ProdId = "-//pm-platform//F2-19//EN";

    public record IcsAttendee(string Email, string FullName, bool Required);

    public string Build(
        Guid seriesId,
        DateTime startUtc,
        int durationMinutes,
        string summary,
        string? description,
        string organiserEmail,
        string organiserFullName,
        IReadOnlyList<IcsAttendee> attendees,
        string? recurrenceRule,
        bool cancelled = false)
    {
        if (durationMinutes <= 0)
            throw new ArgumentOutOfRangeException(nameof(durationMinutes));

        var sb = new StringBuilder();
        AppendLine(sb, "BEGIN:VCALENDAR");
        AppendLine(sb, "VERSION:2.0");
        AppendLine(sb, $"PRODID:{ProdId}");
        AppendLine(sb, $"METHOD:{(cancelled ? "CANCEL" : "REQUEST")}");
        AppendLine(sb, "CALSCALE:GREGORIAN");
        AppendLine(sb, "BEGIN:VEVENT");
        AppendLine(sb, $"UID:{seriesId:D}@pm-platform");
        AppendLine(sb, $"DTSTAMP:{FormatUtc(DateTime.UtcNow)}");
        AppendLine(sb, $"DTSTART:{FormatUtc(startUtc)}");
        AppendLine(sb, $"DTEND:{FormatUtc(startUtc.AddMinutes(durationMinutes))}");
        AppendLine(sb, $"SUMMARY:{Escape(summary)}");
        if (!string.IsNullOrWhiteSpace(description))
            AppendLine(sb, $"DESCRIPTION:{Escape(description)}");

        AppendLine(sb,
            $"ORGANIZER;CN={Escape(organiserFullName)}:mailto:{organiserEmail}");

        foreach (var a in attendees)
        {
            var role = a.Required ? "REQ-PARTICIPANT" : "OPT-PARTICIPANT";
            AppendLine(sb,
                "ATTENDEE;ROLE=" + role +
                ";PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=" + Escape(a.FullName) +
                ":mailto:" + a.Email);
        }

        if (!string.IsNullOrWhiteSpace(recurrenceRule))
            AppendLine(sb, $"RRULE:{recurrenceRule!.Trim()}");

        if (cancelled)
            AppendLine(sb, "STATUS:CANCELLED");

        AppendLine(sb, "END:VEVENT");
        AppendLine(sb, "END:VCALENDAR");
        return sb.ToString();
    }

    /// <summary>UTC timestamps render as YYYYMMDDTHHMMSSZ per spec.</summary>
    private static string FormatUtc(DateTime utc) =>
        utc.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);

    /// <summary>
    /// Escape per RFC 5545 §3.3.11: backslash, comma, semicolon become
    /// escaped sequences, and CRLF becomes a literal \n. Newlines in
    /// the input are normalised to spaces so the property folder
    /// doesn't have to deal with mid-string CR / LF.
    /// </summary>
    private static string Escape(string value)
    {
        var v = value.Replace("\\", "\\\\")
            .Replace("\r\n", "\\n")
            .Replace("\r", "\\n")
            .Replace("\n", "\\n")
            .Replace(",", "\\,")
            .Replace(";", "\\;");
        return v;
    }

    /// <summary>
    /// Append a content line with the 75-octet fold the spec requires.
    /// Each continuation begins with a single leading space so the
    /// parser knows to join with the previous line.
    /// </summary>
    private static void AppendLine(StringBuilder sb, string line)
    {
        const int limit = 75;
        if (line.Length <= limit)
        {
            sb.Append(line).Append("\r\n");
            return;
        }
        var pos = 0;
        var first = true;
        while (pos < line.Length)
        {
            var chunkLen = first ? limit : limit - 1;
            chunkLen = Math.Min(chunkLen, line.Length - pos);
            if (!first) sb.Append(' ');
            sb.Append(line.AsSpan(pos, chunkLen)).Append("\r\n");
            pos += chunkLen;
            first = false;
        }
    }
}
