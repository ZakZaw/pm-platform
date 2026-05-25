using Application.Common;
using Application.Features.Notifications.Commands;
using Application.Features.Notifications.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class NotificationsController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/users/me/notifications")]
    public async Task<ActionResult<NotificationInboxDto>> GetMine(
        [FromQuery] int limit = 50,
        [FromQuery] DateTime? before = null,
        [FromQuery(Name = "unread_only")] bool unreadOnly = false,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetMyNotificationsQuery(limit, before, unreadOnly), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/notifications/{id:guid}/read")]
    public async Task<ActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new MarkNotificationReadCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/notifications/read-all")]
    public async Task<ActionResult> MarkAllRead(CancellationToken ct)
    {
        var result = await mediator.Send(new MarkAllNotificationsReadCommand(), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Notification.NotFound" => StatusCodes.Status404NotFound,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}
