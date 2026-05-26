using Api.Authorization;
using Application.Common;
using Application.Features.Sprints;
using Application.Features.Sprints.Commands;
using Application.Features.Sprints.Queries;
using Application.Features.Sprints.Retrospective;
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
            projectId, body.Name, body.StartDate, body.EndDate, body.VelocityTarget), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/sprints/{id:guid}")]
    public async Task<ActionResult<SprintDto>> Update(
        Guid id, [FromBody] UpdateSprintBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateSprintCommand(
            id, body.Name, body.StartDate, body.EndDate, body.VelocityTarget,
            body.ClearVelocityTarget ?? false), ct);
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

    // F2-11 sprint retrospective endpoints.
    [HttpGet("api/v1/sprints/{id:guid}/retro")]
    public async Task<ActionResult<SprintRetrospectiveDto>> GetRetro(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetSprintRetrospectiveQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/sprints/{id:guid}/retro/generate")]
    public async Task<ActionResult<SprintRetrospectiveDto>> GenerateRetro(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GenerateSprintRetrospectiveCommand(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/sprints/{id:guid}/retro")]
    public async Task<ActionResult<SprintRetrospectiveDto>> UpdateRetro(
        Guid id, [FromBody] UpdateRetroBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateSprintRetrospectiveCommand(
            id, body.Summary, body.WhatWentWell, body.WhatDidnt, body.Suggestions), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/sprints/{id:guid}/retro/apply-next")]
    public async Task<ActionResult<SprintDto>> ApplyNext(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new ApplyNextSprintDraftCommand(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
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
            "Sprint.NotClosed" => StatusCodes.Status422UnprocessableEntity,
            "Sprint.RetroNotFound" => StatusCodes.Status404NotFound,
            "Sprint.RetroAlreadyApplied" => StatusCodes.Status409Conflict,
            "Task.SprintNotInProject" => StatusCodes.Status422UnprocessableEntity,
            "Project.NotAMember" => StatusCodes.Status403Forbidden,
            "Project.InsufficientRole" => StatusCodes.Status403Forbidden,
            "AI.NotConfigured" => StatusCodes.Status503ServiceUnavailable,
            "AI.DisabledForProject" => StatusCodes.Status409Conflict,
            "AI.ProviderFailed" => StatusCodes.Status502BadGateway,
            "AI.EmptyResult" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateSprintBodyDto(
    string Name,
    DateTime StartDate,
    DateTime EndDate,
    int? VelocityTarget);

public record UpdateSprintBodyDto(
    string? Name,
    DateTime? StartDate,
    DateTime? EndDate,
    int? VelocityTarget,
    bool? ClearVelocityTarget);

public record CloseSprintBodyDto(bool MoveCarryoversToBacklog);

public record UpdateRetroBodyDto(
    string? Summary,
    string? WhatWentWell,
    string? WhatDidnt,
    string? Suggestions);
