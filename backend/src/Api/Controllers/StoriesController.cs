using Api.Authorization;
using Application.Common;
using Application.Features.Stories;
using Application.Features.Stories.Commands;
using Application.Features.Stories.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class StoriesController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/projects/{projectId:guid}/stories")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<IReadOnlyList<StoryDto>>> List(
        Guid projectId,
        [FromQuery] Guid? epicId = null,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new ListProjectStoriesQuery(projectId, epicId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/stories")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<ActionResult<StoryDto>> Create(
        Guid projectId,
        [FromBody] CreateStoryBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new CreateStoryCommand(
            projectId, body.EpicId, body.Title, body.Description,
            body.StoryPoints, body.Priority, body.AcceptanceCriteria,
            body.AssigneeId, body.DueDate), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/stories/{id:guid}")]
    public async Task<ActionResult<StoryDto>> Get(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetStoryQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/stories/{id:guid}")]
    public async Task<ActionResult<StoryDto>> Update(
        Guid id,
        [FromBody] UpdateStoryBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateStoryCommand(
            id, body.Title, body.Description, body.StoryPoints, body.Priority,
            body.EpicId, body.AssigneeId, body.DueDate, body.AcceptanceCriteria), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/stories/{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteStoryCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Story.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotAMember" => StatusCodes.Status403Forbidden,
            "Project.InsufficientRole" => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateStoryBodyDto(
    Guid? EpicId,
    string Title,
    string? Description,
    int? StoryPoints,
    string? Priority,
    string[]? AcceptanceCriteria,
    Guid? AssigneeId,
    DateTime? DueDate);

public record UpdateStoryBodyDto(
    string? Title,
    string? Description,
    int? StoryPoints,
    string? Priority,
    Guid? EpicId,
    Guid? AssigneeId,
    DateTime? DueDate,
    string[]? AcceptanceCriteria);
