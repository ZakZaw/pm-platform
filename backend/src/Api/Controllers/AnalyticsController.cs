using Api.Authorization;
using Application.Common;
using Application.Features.Analytics;
using Application.Features.Analytics.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class AnalyticsController(ISender mediator) : ControllerBase
{
    // AN-01 — sprint burndown. Omit sprint_id to chart the active sprint.
    [HttpGet("api/v1/projects/{projectId:guid}/analytics/burndown")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<BurndownDto>> Burndown(
        Guid projectId, [FromQuery(Name = "sprint_id")] Guid? sprintId, CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetBurndownQuery(projectId, sprintId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // AN-02 — velocity of the last six started sprints with a rolling average.
    [HttpGet("api/v1/projects/{projectId:guid}/analytics/velocity")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<VelocityDto>> Velocity(Guid projectId, CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetVelocityQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // AN-03 — per-epic completion (points + counts).
    [HttpGet("api/v1/projects/{projectId:guid}/analytics/epic-progress")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<EpicProgressResultDto>> EpicProgress(Guid projectId, CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetEpicProgressQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // Project health (F3-16) — composite score + component signals, on demand.
    [HttpGet("api/v1/projects/{projectId:guid}/analytics/health")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<HealthDto>> Health(Guid projectId, CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetProjectHealthQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // Headline KPI strip — open tasks, on-track %, bug ratio, avg cycle time.
    [HttpGet("api/v1/projects/{projectId:guid}/analytics/kpis")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<ProjectKpisDto>> Kpis(Guid projectId, CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetProjectKpisQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // Team workload heatmap (F3-14) — per-member daily Done throughput.
    [HttpGet("api/v1/projects/{projectId:guid}/analytics/workload")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<WorkloadDto>> Workload(Guid projectId, CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetWorkloadQuery(projectId), ct);
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
