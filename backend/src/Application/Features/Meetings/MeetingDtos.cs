namespace Application.Features.Meetings;

public record MeetingAttendeeDto(
    Guid UserId,
    string FullName,
    string Email,
    string? AvatarUrl,
    bool Required,
    string Response,
    DateTime? RespondedAt);

/// <summary>
/// Per-instance summary used by the list view and the calendar /
/// inbox. <see cref="IsRecurring"/> is denormalised from the RRULE so
/// the UI can render the "series" chip without parsing the rule.
/// </summary>
public record MeetingListItemDto(
    Guid Id,
    Guid SeriesId,
    string Title,
    string Type,
    string Status,
    DateTime ScheduledAt,
    int DurationMinutes,
    bool IsRecurring,
    Guid OrganizerId,
    string OrganizerFullName,
    int AttendeeCount,
    int AcceptedCount,
    string? MyResponse);

public record MeetingDetailDto(
    Guid Id,
    Guid SeriesId,
    Guid ProjectId,
    string ProjectName,
    string ProjectSlug,
    string Title,
    string? Description,
    string Type,
    string Status,
    DateTime ScheduledAt,
    int DurationMinutes,
    string? RecurrenceRule,
    string? AgendaMd,
    bool AgendaFromAi,
    Guid OrganizerId,
    string OrganizerFullName,
    string OrganizerEmail,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<MeetingAttendeeDto> Attendees);
