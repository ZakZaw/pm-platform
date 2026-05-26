using Application.Common;
using Application.Features.TimeLogs;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class TimeLogsController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/tasks/{taskId:guid}/time-logs")]
    public async Task<ActionResult<IReadOnlyList<TimeLogDto>>> List(Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListTaskTimeLogsQuery(taskId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/tasks/{taskId:guid}/time-logs")]
    public async Task<ActionResult<TimeLogDto>> Log(
        Guid taskId, [FromBody] LogTimeBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new LogTimeCommand(
            taskId, body.Minutes, body.LoggedAt, body.Comment), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/time-logs/{timeLogId:guid}")]
    public async Task<ActionResult> Delete(Guid timeLogId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteTimeLogCommand(timeLogId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Task.NotFound" => StatusCodes.Status404NotFound,
            "TimeLog.NotFound" => StatusCodes.Status404NotFound,
            "TimeLog.InvalidMinutes" => StatusCodes.Status422UnprocessableEntity,
            "TimeLog.Forbidden" => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record LogTimeBodyDto(int Minutes, DateTime? LoggedAt, string? Comment);
