using Api.Authorization;
using Application.Common;
using Application.Features.Sprints;
using Application.Features.Sprints.Commands;
using Application.Features.Sprints.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class SprintsController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/projects/{projectId:guid}/sprints")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<IReadOnlyList<SprintDto>>> List(Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListProjectSprintsQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/projects/{projectId:guid}/sprints/active")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<SprintDto?>> GetActive(Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetActiveSprintQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/sprints")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<SprintDto>> Create(
        Guid projectId, [FromBody] CreateSprintBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateSprintCommand(
            projectId, body.Name, body.Goal, body.StartDate, body.EndDate, body.VelocityTarget), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/sprints/{id:guid}/start")]
    public async Task<ActionResult<SprintDto>> Start(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new StartSprintCommand(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/sprints/{id:guid}/close")]
    public async Task<ActionResult<SprintDto>> Close(
        Guid id, [FromBody] CloseSprintBodyDto? body, CancellationToken ct)
    {
        var result = await mediator.Send(new CloseSprintCommand(id, body?.MoveCarryoversToBacklog ?? true), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/sprints/{id:guid}/tasks/{taskId:guid}")]
    public async Task<ActionResult> AddTask(Guid id, Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new AddTaskToSprintCommand(id, taskId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/sprints/tasks/{taskId:guid}")]
    public async Task<ActionResult> RemoveTask(Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new RemoveTaskFromSprintCommand(taskId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Sprint.NotFound" => StatusCodes.Status404NotFound,
            "Task.NotFound" => StatusCodes.Status404NotFound,
            "Sprint.EmptyScope" => StatusCodes.Status422UnprocessableEntity,
            "Sprint.ActiveExists" => StatusCodes.Status409Conflict,
            "Sprint.NotPlanning" => StatusCodes.Status422UnprocessableEntity,
            "Sprint.NotActive" => StatusCodes.Status422UnprocessableEntity,
            "Task.SprintNotInProject" => StatusCodes.Status422UnprocessableEntity,
            "Project.NotAMember" => StatusCodes.Status403Forbidden,
            "Project.InsufficientRole" => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateSprintBodyDto(
    string Name,
    string? Goal,
    DateTime StartDate,
    DateTime EndDate,
    int? VelocityTarget);

public record CloseSprintBodyDto(bool MoveCarryoversToBacklog);
