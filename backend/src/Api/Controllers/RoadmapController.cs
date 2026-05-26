using Api.Authorization;
using Application.Common;
using Application.Features.Roadmap.Commands;
using Application.Features.Roadmap.Queries;
using Domain.Enums;
using Infrastructure.Services;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class RoadmapController(ISender mediator, IOptions<FrontendSettings> frontend) : ControllerBase
{
    [HttpGet("api/v1/projects/{projectId:guid}/roadmap")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<ProjectRoadmapDto>> Get(
        Guid projectId, CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetProjectRoadmapQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/projects/{projectId:guid}/epics/{epicId:guid}/dates")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<EpicDatesUpdateResult>> UpdateEpicDates(
        Guid projectId,
        Guid epicId,
        [FromBody] UpdateEpicDatesBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new UpdateEpicDatesCommand(epicId, body.StartDate, body.EndDate, body.Cascade), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/milestones")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<MilestoneDto>> CreateMilestone(
        Guid projectId,
        [FromBody] CreateMilestoneBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new CreateMilestoneCommand(projectId, body.Title, body.Date, body.Color, body.EpicId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/projects/{projectId:guid}/milestones/{milestoneId:guid}")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<MilestoneDto>> UpdateMilestone(
        Guid projectId,
        Guid milestoneId,
        [FromBody] UpdateMilestoneBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateMilestoneCommand(
            milestoneId, body.Title, body.Date, body.Color, body.EpicId, body.ClearEpic ?? false), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/projects/{projectId:guid}/milestones/{milestoneId:guid}")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult> DeleteMilestone(
        Guid projectId, Guid milestoneId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteMilestoneCommand(milestoneId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/epics/{epicId:guid}/dependencies")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<EpicDependencyDto>> AddDependency(
        Guid projectId, Guid epicId,
        [FromBody] AddEpicDependencyBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new AddEpicDependencyCommand(epicId, body.DependsOnEpicId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/projects/{projectId:guid}/epics/{epicId:guid}/dependencies/{prereqId:guid}")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult> RemoveDependency(
        Guid projectId, Guid epicId, Guid prereqId, CancellationToken ct)
    {
        var result = await mediator.Send(new RemoveEpicDependencyCommand(epicId, prereqId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/roadmap/share-links")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<RoadmapShareLinkResponseDto>> CreateShareLink(
        Guid projectId,
        [FromBody] CreateShareLinkBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new CreateRoadmapShareLinkCommand(
            projectId, body.Password, body.ExpiresAt,
            body.HideInternalLabels ?? false, body.HideAssignees ?? false), ct);
        if (!result.IsSuccess) return ToProblem(result.Error!);
        return Ok(WithUrl(result.Value!));
    }

    [HttpGet("api/v1/projects/{projectId:guid}/roadmap/share-links")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<IReadOnlyList<RoadmapShareLinkResponseDto>>> ListShareLinks(
        Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListRoadmapShareLinksQuery(projectId), ct);
        if (!result.IsSuccess) return ToProblem(result.Error!);
        return Ok(result.Value!.Select(WithUrl).ToList());
    }

    [HttpDelete("api/v1/projects/{projectId:guid}/roadmap/share-links/{linkId:guid}")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult> RevokeShareLink(
        Guid projectId, Guid linkId, CancellationToken ct)
    {
        var result = await mediator.Send(new RevokeRoadmapShareLinkCommand(linkId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private RoadmapShareLinkResponseDto WithUrl(RoadmapShareLinkDto dto)
    {
        var baseUrl = (frontend.Value.BaseUrl ?? string.Empty).TrimEnd('/');
        var url = $"{baseUrl}/share/roadmap/{dto.Token}";
        return new RoadmapShareLinkResponseDto(
            dto.Id, dto.ProjectId, dto.Token, url, dto.HasPassword,
            dto.ExpiresAt, dto.HideInternalLabels, dto.HideAssignees,
            dto.CreatedByUserId, dto.CreatedByName, dto.CreatedAt, dto.RevokedAt);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotAMember" => StatusCodes.Status403Forbidden,
            "Project.InsufficientRole" => StatusCodes.Status403Forbidden,
            "Epic.NotFound" => StatusCodes.Status404NotFound,
            "Epic.InvalidDateRange" => StatusCodes.Status422UnprocessableEntity,
            "Epic.DependencyCycle" => StatusCodes.Status409Conflict,
            "Epic.DependencyNotInProject" => StatusCodes.Status422UnprocessableEntity,
            "Epic.DependencyNotFound" => StatusCodes.Status404NotFound,
            "Milestone.NotFound" => StatusCodes.Status404NotFound,
            "Milestone.InvalidTitle" => StatusCodes.Status422UnprocessableEntity,
            "Milestone.EpicNotInProject" => StatusCodes.Status422UnprocessableEntity,
            "RoadmapShare.InvalidExpiry" => StatusCodes.Status422UnprocessableEntity,
            "RoadmapShare.InvalidPasswordValue" => StatusCodes.Status422UnprocessableEntity,
            "RoadmapShare.NotFound" => StatusCodes.Status404NotFound,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateShareLinkBodyDto(
    string? Password,
    DateTime? ExpiresAt,
    bool? HideInternalLabels,
    bool? HideAssignees);

public record RoadmapShareLinkResponseDto(
    Guid Id,
    Guid ProjectId,
    string Token,
    string Url,
    bool HasPassword,
    DateTime? ExpiresAt,
    bool HideInternalLabels,
    bool HideAssignees,
    Guid CreatedByUserId,
    string? CreatedByName,
    DateTime CreatedAt,
    DateTime? RevokedAt);

public record UpdateEpicDatesBodyDto(
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool Cascade = false);

public record CreateMilestoneBodyDto(
    string Title,
    DateOnly Date,
    string? Color,
    Guid? EpicId);

public record UpdateMilestoneBodyDto(
    string? Title,
    DateOnly? Date,
    string? Color,
    Guid? EpicId,
    bool? ClearEpic);

public record AddEpicDependencyBodyDto(Guid DependsOnEpicId);
