using Application.Common;
using Application.Features.Tasks;
using Application.Features.Tasks.Commands;
using Application.Features.Tasks.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class TasksController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/stories/{storyId:guid}/tasks")]
    public async Task<ActionResult<IReadOnlyList<TaskDto>>> ListForStory(Guid storyId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListStoryTasksQuery(storyId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/stories/{storyId:guid}/tasks")]
    public async Task<ActionResult<TaskDto>> Create(
        Guid storyId,
        [FromBody] CreateTaskBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new CreateTaskCommand(
            storyId, body.Title, body.Description, body.Priority, body.AssigneeId, body.ReviewerId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/tasks/{id:guid}")]
    public async Task<ActionResult<TaskDto>> Get(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetTaskQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/tasks/{id:guid}")]
    public async Task<ActionResult<TaskDto>> Update(
        Guid id,
        [FromBody] UpdateTaskBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateTaskCommand(
            id, body.Title, body.Description, body.Priority,
            body.AssigneeId, body.ReviewerId, body.TimeLoggedMinutes, body.PrUrl), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/tasks/{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteTaskCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/tasks/{id:guid}/status")]
    public async Task<ActionResult<TaskDto>> ChangeStatus(
        Guid id,
        [FromBody] ChangeTaskStatusBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateTaskStatusCommand(id, body.To, body.Reason), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Task.NotFound" => StatusCodes.Status404NotFound,
            "Task.InvalidTransition" => StatusCodes.Status422UnprocessableEntity,
            "Task.NoOpTransition" => StatusCodes.Status422UnprocessableEntity,
            "Task.ReasonRequired" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateTaskBodyDto(
    string Title,
    string? Description,
    string? Priority,
    Guid? AssigneeId,
    Guid? ReviewerId);

public record UpdateTaskBodyDto(
    string? Title,
    string? Description,
    string? Priority,
    Guid? AssigneeId,
    Guid? ReviewerId,
    int? TimeLoggedMinutes,
    string? PrUrl);

public record ChangeTaskStatusBodyDto(string To, string? Reason);
