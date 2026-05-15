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

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Org.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotAMember" => StatusCodes.Status403Forbidden,
            "Project.InsufficientRole" => StatusCodes.Status403Forbidden,
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
