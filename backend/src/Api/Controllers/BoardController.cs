using Api.Authorization;
using Application.Common;
using Application.Features.Board;
using Application.Features.Sprints.Commands;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class BoardController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/projects/{projectId:guid}/board")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<BoardDto>> GetBoard(
        Guid projectId,
        [FromQuery(Name = "sprint_id")] Guid? sprintId = null,
        [FromQuery(Name = "swimlane_by")] string? swimlaneBy = null,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetBoardQuery(projectId, sprintId, swimlaneBy), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/projects/{projectId:guid}/backlog")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<BacklogDto>> GetBacklog(
        Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetBacklogQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/backlog/reorder")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<ActionResult> Reorder(
        Guid projectId, [FromBody] ReorderBacklogBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new ReorderBacklogCommand(projectId, body.TaskIds), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotAMember" => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record ReorderBacklogBodyDto(IReadOnlyList<Guid> TaskIds);
