using Application.Common;
using Application.Features.AI;
using Application.Features.Meetings;
using Application.Features.Meetings.Commands;
using Application.Features.Meetings.Queries;
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
            "AI.NotConfigured" => StatusCodes.Status503ServiceUnavailable,
            "AI.ProviderFailed" => StatusCodes.Status502BadGateway,
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
