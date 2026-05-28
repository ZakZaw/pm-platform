using Application.Common;
using Application.Features.AI;
using Application.Features.Meetings;
using Application.Features.Meetings.Commands;
using Application.Features.Meetings.Processing;
using Application.Features.Meetings.Queries;
using Application.Features.Meetings.Transcripts;
using Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// F2-19 — scheduled meetings on a project. Owns CRUD + RSVP +
/// AI agenda preview. Calendar invites are .ics attachments sent
/// out by the create/cancel handlers (best-effort; failure doesn't
/// roll back the meeting).
/// </summary>
[ApiController]
[Authorize]
public class MeetingsController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/projects/{projectId:guid}/meetings")]
    public async Task<ActionResult<IReadOnlyList<MeetingListItemDto>>> List(
        Guid projectId,
        [FromQuery(Name = "include_past")] bool includePast = false,
        [FromQuery(Name = "include_cancelled")] bool includeCancelled = false,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(
            new ListProjectMeetingsQuery(projectId, includePast, includeCancelled), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/meetings/{id:guid}")]
    public async Task<ActionResult<MeetingDetailDto>> Get(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetMeetingQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/meetings")]
    public async Task<ActionResult<MeetingDetailDto>> Create(
        Guid projectId, [FromBody] CreateMeetingBodyDto body, CancellationToken ct)
    {
        var attendees = (body.Attendees ?? [])
            .Select(a => new MeetingAttendeeInput(a.UserId, a.Required ?? true))
            .ToList();
        var result = await mediator.Send(new CreateMeetingCommand(
            projectId,
            body.Title ?? string.Empty,
            body.Description,
            body.Type ?? string.Empty,
            body.ScheduledAt ?? DateTime.UtcNow,
            body.DurationMinutes ?? 0,
            body.RecurrenceRule,
            body.AgendaMd,
            body.AgendaFromAi ?? false,
            attendees), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/meetings/{id:guid}")]
    public async Task<ActionResult<MeetingDetailDto>> Update(
        Guid id, [FromBody] UpdateMeetingBodyDto body, CancellationToken ct)
    {
        var attendees = body.Attendees?
            .Select(a => new MeetingAttendeeInput(a.UserId, a.Required ?? true))
            .ToList();
        var result = await mediator.Send(new UpdateMeetingCommand(
            id, body.Title, body.Description, body.ClearDescription ?? false,
            body.Type, body.ScheduledAt, body.DurationMinutes,
            body.RecurrenceRule, body.ClearRecurrence ?? false,
            body.AgendaMd, body.ClearAgenda ?? false, body.AgendaFromAi,
            attendees), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/meetings/{id:guid}")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new CancelMeetingCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/meetings/{id:guid}/rsvp")]
    public async Task<ActionResult<MeetingDetailDto>> Rsvp(
        Guid id, [FromBody] RsvpBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new RespondToMeetingCommand(id, body.Response ?? string.Empty), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/meetings/agenda-preview")]
    public async Task<ActionResult<AIMeetingAgenda>> PreviewAgenda(
        Guid projectId, [FromBody] PreviewAgendaBodyDto body, CancellationToken ct)
    {
        var ids = (body.AttendeeUserIds ?? []).Where(g => g != Guid.Empty).ToList();
        var result = await mediator.Send(new PreviewMeetingAgendaCommand(
            projectId,
            body.Type ?? string.Empty,
            body.Title ?? string.Empty,
            body.DurationMinutes ?? 30,
            ids,
            body.OrganiserNotes), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // F2-20 — issue a LiveKit access token. Attendee-only; the room
    // opens 15 min before the scheduled start.
    [HttpPost("api/v1/meetings/{id:guid}/join")]
    public async Task<ActionResult<MeetingJoinTokenDto>> Join(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new JoinMeetingCommand(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/meetings/{id:guid}/guest-links")]
    public async Task<ActionResult<MeetingGuestLinkDto>> CreateGuestLink(
        Guid id, [FromBody] CreateGuestLinkBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateGuestLinkCommand(
            id, body.GuestLabel, body.HoursValid), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/meetings/{id:guid}/guest-links")]
    public async Task<ActionResult<IReadOnlyList<MeetingGuestLinkDto>>> ListGuestLinks(
        Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new ListGuestLinksQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/meetings/guest-links/{id:guid}")]
    public async Task<IActionResult> RevokeGuestLink(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new RevokeGuestLinkCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    // Anonymous endpoint — the guest token itself is the credential.
    [AllowAnonymous]
    [HttpPost("api/v1/meetings/guest/{token}/join")]
    public async Task<ActionResult<MeetingJoinTokenDto>> JoinAsGuest(
        string token, [FromBody] GuestJoinBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new JoinAsGuestCommand(token, body.DisplayName), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // F2-21 transcript — POST appends a finalised segment, GET returns
    // the accumulated history, /download renders .txt or .vtt.
    [HttpPost("api/v1/meetings/{id:guid}/transcript/segments")]
    public async Task<ActionResult<TranscriptSegmentDto>> PostTranscriptSegment(
        Guid id, [FromBody] PostTranscriptSegmentBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new PostTranscriptSegmentCommand(
            id,
            body.Text ?? string.Empty,
            body.StartedAt ?? DateTime.UtcNow,
            body.EndedAt ?? DateTime.UtcNow), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/meetings/{id:guid}/transcript")]
    public async Task<ActionResult<MeetingTranscriptDto>> GetTranscript(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetMeetingTranscriptQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/meetings/{id:guid}/transcript/download")]
    public async Task<IActionResult> DownloadTranscript(
        Guid id,
        [FromQuery] string format = "txt",
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new RenderTranscriptQuery(id, format), ct);
        if (!result.IsSuccess) return ToProblem(result.Error!);
        var rendered = result.Value!;
        return File(System.Text.Encoding.UTF8.GetBytes(rendered.Body),
            rendered.MimeType, rendered.FileName);
    }

    // F2-22 post-meeting AI processing.
    [HttpPost("api/v1/meetings/{id:guid}/finalise")]
    public async Task<ActionResult<MeetingSummaryDto>> Finalise(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new FinaliseMeetingCommand(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/meetings/{id:guid}/process")]
    public async Task<ActionResult<MeetingSummaryDto>> Process(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new ProcessMeetingTranscriptCommand(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/meetings/{id:guid}/summary")]
    public async Task<ActionResult<MeetingSummaryDto>> GetSummary(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetMeetingSummaryQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/meetings/{id:guid}/action-items")]
    public async Task<ActionResult<IReadOnlyList<MeetingActionItemDto>>> ListActionItems(
        Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new ListActionItemsQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/action-items/{id:guid}/accept")]
    public async Task<ActionResult<MeetingActionItemDto>> AcceptActionItem(
        Guid id, [FromBody] AcceptActionItemBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new AcceptActionItemCommand(
            id, body.ExistingTaskId, body.Title, body.Description,
            body.AssigneeId, body.DueDate, body.Priority), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/meetings/{id:guid}/action-items/bulk-accept")]
    public async Task<ActionResult<IReadOnlyList<MeetingActionItemDto>>> BulkAcceptActionItems(
        Guid id, [FromBody] BulkAcceptActionItemsBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new AcceptActionItemsBulkCommand(
            id, body.ActionItemIds ?? []), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/action-items/{id:guid}/dismiss")]
    public async Task<ActionResult<MeetingActionItemDto>> DismissActionItem(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DismissActionItemCommand(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Meeting.NotFound" => StatusCodes.Status404NotFound,
            "Meeting.NotOrganiser" => StatusCodes.Status403Forbidden,
            "Meeting.NotAttendee" => StatusCodes.Status403Forbidden,
            "Meeting.AlreadyStarted" => StatusCodes.Status409Conflict,
            "Meeting.AlreadyCancelled" => StatusCodes.Status409Conflict,
            "Meeting.AttendeeNotInProject" => StatusCodes.Status422UnprocessableEntity,
            "Meeting.AttendeesRequired" => StatusCodes.Status422UnprocessableEntity,
            "Meeting.InvalidTitle" => StatusCodes.Status422UnprocessableEntity,
            "Meeting.InvalidType" => StatusCodes.Status422UnprocessableEntity,
            "Meeting.InvalidDuration" => StatusCodes.Status422UnprocessableEntity,
            "Meeting.InvalidScheduledAt" => StatusCodes.Status422UnprocessableEntity,
            "Meeting.InvalidRecurrence" => StatusCodes.Status422UnprocessableEntity,
            "Meeting.TooEarlyToJoin" => StatusCodes.Status409Conflict,
            "Meeting.GuestLinkNotFound" => StatusCodes.Status404NotFound,
            "Meeting.GuestLinkExpired" => StatusCodes.Status410Gone,
            "AI.NotConfigured" => StatusCodes.Status503ServiceUnavailable,
            "AI.ProviderFailed" => StatusCodes.Status502BadGateway,
            "Video.NotConfigured" => StatusCodes.Status503ServiceUnavailable,
            "Transcript.EmptyText" => StatusCodes.Status422UnprocessableEntity,
            "Transcript.TooLong" => StatusCodes.Status422UnprocessableEntity,
            "Transcript.InvalidFormat" => StatusCodes.Status422UnprocessableEntity,
            "Transcript.AlreadyFinalised" => StatusCodes.Status409Conflict,
            "ActionItem.NotFound" => StatusCodes.Status404NotFound,
            "ActionItem.AlreadyAccepted" => StatusCodes.Status409Conflict,
            "ActionItem.AlreadyDismissed" => StatusCodes.Status409Conflict,
            "ActionItem.InvalidTitle" => StatusCodes.Status422UnprocessableEntity,
            "ActionItem.EmptyTranscript" => StatusCodes.Status422UnprocessableEntity,
            "Task.NotFound" => StatusCodes.Status404NotFound,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record MeetingAttendeeBodyDto(Guid UserId, bool? Required);

public record CreateMeetingBodyDto(
    string? Title,
    string? Description,
    string? Type,
    DateTime? ScheduledAt,
    int? DurationMinutes,
    string? RecurrenceRule,
    string? AgendaMd,
    bool? AgendaFromAi,
    IReadOnlyList<MeetingAttendeeBodyDto>? Attendees);

public record UpdateMeetingBodyDto(
    string? Title,
    string? Description,
    bool? ClearDescription,
    string? Type,
    DateTime? ScheduledAt,
    int? DurationMinutes,
    string? RecurrenceRule,
    bool? ClearRecurrence,
    string? AgendaMd,
    bool? ClearAgenda,
    bool? AgendaFromAi,
    IReadOnlyList<MeetingAttendeeBodyDto>? Attendees);

public record RsvpBodyDto(string? Response);

public record PreviewAgendaBodyDto(
    string? Title,
    string? Type,
    int? DurationMinutes,
    IReadOnlyList<Guid>? AttendeeUserIds,
    string? OrganiserNotes);

public record CreateGuestLinkBodyDto(string? GuestLabel, int? HoursValid);
public record GuestJoinBodyDto(string? DisplayName);
public record PostTranscriptSegmentBodyDto(
    string? Text, DateTime? StartedAt, DateTime? EndedAt);

public record AcceptActionItemBodyDto(
    Guid? ExistingTaskId,
    string? Title,
    string? Description,
    Guid? AssigneeId,
    DateTime? DueDate,
    string? Priority);

public record BulkAcceptActionItemsBodyDto(IReadOnlyList<Guid>? ActionItemIds);
