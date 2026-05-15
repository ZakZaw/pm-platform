using Application.Common;
using Application.Features.Subtasks;
using Application.Features.Subtasks.Commands;
using Application.Features.Subtasks.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class SubtasksController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/tasks/{taskId:guid}/subtasks")]
    public async Task<ActionResult<IReadOnlyList<SubtaskDto>>> List(Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListTaskSubtasksQuery(taskId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/tasks/{taskId:guid}/subtasks")]
    public async Task<ActionResult<SubtaskDto>> Create(
        Guid taskId,
        [FromBody] CreateSubtaskBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new CreateSubtaskCommand(taskId, body.Title, body.AssigneeId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/subtasks/{id:guid}")]
    public async Task<ActionResult<SubtaskDto>> Update(
        Guid id,
        [FromBody] UpdateSubtaskBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateSubtaskCommand(id, body.Title, body.Completed, body.AssigneeId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/subtasks/{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteSubtaskCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Subtask.NotFound" => StatusCodes.Status404NotFound,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateSubtaskBodyDto(string Title, Guid? AssigneeId);
public record UpdateSubtaskBodyDto(string? Title, bool? Completed, Guid? AssigneeId);
