using Api.Authorization;
using Application.Common;
using Application.Features.Dashboard.Commands;
using Application.Features.Dashboard.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class DashboardController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/projects/{projectId:guid}/dashboard/layout")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<DashboardLayoutDto>> GetLayout(
        Guid projectId, CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetDashboardLayoutQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPut("api/v1/projects/{projectId:guid}/dashboard/layout")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult> SaveLayout(
        Guid projectId,
        [FromBody] SaveDashboardLayoutBodyDto body,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(
            new SaveDashboardLayoutCommand(projectId, body.LayoutJson), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotAMember" => StatusCodes.Status403Forbidden,
            "Dashboard.LayoutTooLarge" => StatusCodes.Status413PayloadTooLarge,
            "Dashboard.InvalidJson" => StatusCodes.Status422UnprocessableEntity,
            "Dashboard.EmptyLayout" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record SaveDashboardLayoutBodyDto(string LayoutJson);
