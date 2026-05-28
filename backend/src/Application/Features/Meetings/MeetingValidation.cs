using System.Text.RegularExpressions;
using Application.Common;
using Domain.Enums;

namespace Application.Features.Meetings;

/// <summary>
/// Validation helpers shared by the meeting commands. Kept in one
/// place so the same rules apply at create and update time.
/// </summary>
internal static partial class MeetingValidation
{
    public const int MinDuration = 5;
    public const int MaxDuration = 480;
    public const int MinTitleLength = 2;
    public const int MaxTitleLength = 200;

    /// <summary>
    /// We accept a deliberately narrow RRULE subset for F2-19 — enough
    /// to cover "every weekday", "weekly on Mondays", "monthly on the
    /// 15th". The full spec is enormous and most of it isn't reachable
    /// from the UI. The .ics writer still passes through whatever rule
    /// we store, so adding more clauses later is a parser change only.
    /// </summary>
    [GeneratedRegex(@"^FREQ=(DAILY|WEEKLY|MONTHLY)(;[A-Z]+=[A-Za-z0-9,+\-]+)*$", RegexOptions.Compiled)]
    private static partial Regex RecurrenceRegex();

    public static Result<MeetingType> ParseType(string? raw)
    {
        var v = (raw ?? string.Empty).Trim();
        if (!Enum.TryParse<MeetingType>(v, ignoreCase: true, out var t))
            return Result.Failure<MeetingType>(MeetingErrors.InvalidType);
        return Result.Success(t);
    }

    public static Error? ValidateTitle(string? title)
    {
        var t = (title ?? string.Empty).Trim();
        if (t.Length < MinTitleLength || t.Length > MaxTitleLength)
            return MeetingErrors.InvalidTitle;
        return null;
    }

    public static Error? ValidateDuration(int minutes)
    {
        if (minutes < MinDuration || minutes > MaxDuration)
            return MeetingErrors.InvalidDuration;
        return null;
    }

    public static Error? ValidateScheduledAt(DateTime scheduledAt, DateTime nowUtc)
    {
        // Allow up to a minute of slack so the form-submit-on-the-hour
        // case doesn't trip validation when the round-trip takes longer
        // than the second between "click" and "save".
        if (scheduledAt.ToUniversalTime() < nowUtc.AddMinutes(-1))
            return MeetingErrors.InvalidScheduledAt;
        return null;
    }

    public static Error? ValidateRecurrence(string? rule)
    {
        if (string.IsNullOrWhiteSpace(rule)) return null;
        if (!RecurrenceRegex().IsMatch(rule.Trim()))
            return MeetingErrors.InvalidRecurrence;
        return null;
    }
}
