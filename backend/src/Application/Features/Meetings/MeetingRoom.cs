namespace Application.Features.Meetings;

/// <summary>
/// Helpers for mapping a meeting to its LiveKit room. We use the
/// meeting's <c>SeriesId</c> (not <c>Id</c>) so every instance of a
/// recurring series shares one room — that's what users expect from a
/// recurring meeting URL.
/// </summary>
internal static class MeetingRoom
{
    public static string RoomNameFor(Guid seriesId) => $"meeting-{seriesId:N}";
}

/// <summary>
/// Public DTO returned by the join + guest-join endpoints. Carries
/// exactly what the frontend <c>MeetingRoomPage</c> needs to call
/// <c>connect()</c> on the LiveKit room.
/// </summary>
public record MeetingJoinTokenDto(
    string Token,
    string Url,
    string RoomName,
    string Identity,
    string DisplayName,
    DateTime ExpiresAt,
    Guid MeetingId,
    string MeetingTitle,
    bool RecordingActive);

public record MeetingGuestLinkDto(
    Guid Id,
    Guid MeetingId,
    string Token,
    string? GuestLabel,
    DateTime CreatedAt,
    DateTime ExpiresAt,
    DateTime? RevokedAt,
    string Url);
