using Api.Authorization;
using Application.Common;
using Application.Features.Epics;
using Application.Features.Epics.Commands;
using Application.Features.Epics.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class EpicsController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/projects/{projectId:guid}/epics")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<IReadOnlyList<EpicDto>>> List(
        Guid projectId,
        [FromQuery] bool includeArchived = false,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new ListProjectEpicsQuery(projectId, includeArchived), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/epics")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<EpicDto>> Create(
        Guid projectId,
        [FromBody] CreateEpicBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new CreateEpicCommand(projectId, body.Title, body.Description, body.OwnerId, body.Color, body.EnvironmentType),
            ct);
        return result.IsSuccess
            ? CreatedAtAction(nameof(List), new { projectId }, result.Value)
            : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/epics/{id:guid}")]
    public async Task<ActionResult<EpicDto>> Get(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetEpicQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/epics/{id:guid}")]
    public async Task<ActionResult<EpicDto>> Update(
        Guid id,
        [FromBody] UpdateEpicBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new UpdateEpicCommand(id, body.Title, body.Description, body.OwnerId, body.Status, body.RiskFlag, body.Color),
            ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Epic.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotAMember" => StatusCodes.Status403Forbidden,
            "Project.InsufficientRole" => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateEpicBodyDto(
    string Title,
    string? Description,
    Guid? OwnerId,
    string? Color,
    string? EnvironmentType);

public record UpdateEpicBodyDto(
    string? Title,
    string? Description,
    Guid? OwnerId,
    string? Status,
    bool? RiskFlag,
    string? Color);
