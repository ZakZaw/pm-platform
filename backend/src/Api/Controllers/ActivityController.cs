using Api.Authorization;
using Application.Common;
using Application.Features.ActivityFeed.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class ActivityController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/projects/{projectId:guid}/activity")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<ProjectActivityFeedDto>> Get(
        Guid projectId,
        [FromQuery] int limit = 50,
        [FromQuery] DateTime? before = null,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetProjectActivityQuery(projectId, limit, before), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
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
