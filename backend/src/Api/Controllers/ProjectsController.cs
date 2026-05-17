using Api.Authorization;
using Application.Common;
using Application.Features.Projects;
using Application.Features.Projects.Commands;
using Application.Features.Projects.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class ProjectsController(ISender mediator) : ControllerBase
{
    [HttpPost("api/v1/orgs/{slug}/projects")]
    [RequireOrgRole(OrgRole.Member)]
    public async Task<ActionResult<ProjectDto>> Create(
        string slug,
        [FromBody] CreateProjectBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new CreateProjectCommand(slug, body.Name, body.EnvironmentType, body.AIControlMode, body.TargetDate),
            ct);

        return result.IsSuccess
            ? CreatedAtAction(nameof(GetBySlug),
                new { slug, projectSlug = result.Value!.Slug },
                result.Value)
            : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/orgs/{slug}/projects")]
    [RequireOrgRole(OrgRole.Member)]
    public async Task<ActionResult<IReadOnlyList<ProjectSummary>>> ListForOrg(string slug, CancellationToken ct)
    {
        var result = await mediator.Send(new ListOrgProjectsQuery(slug), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/orgs/{slug}/projects/{projectSlug}")]
    [RequireOrgRole(OrgRole.Member)]
    public async Task<ActionResult<ProjectDto>> GetBySlug(string slug, string projectSlug, CancellationToken ct)
    {
        var result = await mediator.Send(new GetProjectBySlugQuery(slug, projectSlug), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/projects/{projectId:guid}/members")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<IReadOnlyList<ProjectMemberDto>>> ListMembers(
        Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListProjectMembersQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/members")]
    [RequireProjectRole(ProjectRole.PM)]
    public async Task<ActionResult<ProjectMemberDto>> AddMember(
        Guid projectId,
        [FromBody] AddProjectMemberBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new AddProjectMemberCommand(projectId, body.UserId, body.Role), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/projects/{projectId:guid}/members/{userId:guid}")]
    [RequireProjectRole(ProjectRole.PM)]
    public async Task<ActionResult<ProjectMemberDto>> UpdateMemberRole(
        Guid projectId, Guid userId,
        [FromBody] UpdateProjectMemberRoleBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new UpdateProjectMemberRoleCommand(projectId, userId, body.Role ?? string.Empty), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/projects/{projectId:guid}/members/{userId:guid}")]
    [RequireProjectRole(ProjectRole.PM)]
    public async Task<ActionResult> RemoveMember(Guid projectId, Guid userId, CancellationToken ct)
    {
        var result = await mediator.Send(new RemoveProjectMemberCommand(projectId, userId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Org.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotAMember" => StatusCodes.Status403Forbidden,
            "Project.InsufficientRole" => StatusCodes.Status403Forbidden,
            "Project.NotOrgMember" => StatusCodes.Status422UnprocessableEntity,
            "Project.AlreadyMember" => StatusCodes.Status409Conflict,
            "Project.MemberNotFound" => StatusCodes.Status404NotFound,
            "Project.InvalidProjectRole" => StatusCodes.Status422UnprocessableEntity,
            "Project.LastPM" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateProjectBodyDto(
    string Name,
    string EnvironmentType,
    string? AIControlMode,
    DateTime? TargetDate);

public record AddProjectMemberBodyDto(Guid UserId, string? Role);
public record UpdateProjectMemberRoleBodyDto(string? Role);
