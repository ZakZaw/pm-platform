using Application.Common;
using Application.Features.AI;
using Application.Features.AI.Commands;
using Application.Features.Projects;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class AIController(ISender mediator) : ControllerBase
{
    [HttpPost("api/v1/ai/clarify")]
    public async Task<ActionResult<ClarifyResponseDto>> Clarify(
        [FromBody] ClarifyBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new GenerateClarifyingQuestionsCommand(
            body.Description ?? string.Empty, body.EnvironmentType ?? "Developer"), ct);
        return result.IsSuccess
            ? Ok(new ClarifyResponseDto(result.Value!))
            : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/orgs/{slug}/ai/generate-project")]
    public async Task<ActionResult<AIGenerationPreviewDto>> GenerateProject(
        string slug,
        [FromBody] GenerateProjectBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new GenerateProjectPreviewCommand(
            slug,
            body.Description ?? string.Empty,
            body.EnvironmentType ?? "Developer",
            body.Clarifications), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/ai/generate-project/{requestId:guid}/apply")]
    public async Task<ActionResult<ProjectDto>> ApplyGeneratedProject(
        Guid requestId,
        [FromBody] ApplyGenerationBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new ApplyProjectGenerationCommand(
            requestId,
            body.ProjectName ?? string.Empty,
            body.EnvironmentType ?? "Developer",
            body.Epics ?? Array.Empty<AIGeneratedEpicDto>()), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/stories/{storyId:guid}/estimate")]
    public async Task<ActionResult<StoryEstimateDto>> Estimate(
        Guid storyId, CancellationToken ct)
    {
        var result = await mediator.Send(new EstimateStoryPointsCommand(storyId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/sprints/{sprintId:guid}/ai-fill")]
    public async Task<ActionResult<SprintFillPlanDto>> AiFillSprint(
        Guid sprintId,
        [FromQuery(Name = "target")] int? target,
        CancellationToken ct)
    {
        var pct = target is null or <= 0 or > 100 ? 80 : target.Value;
        var result = await mediator.Send(new AiFillSprintCommand(sprintId, pct), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Org.NotFound" => StatusCodes.Status404NotFound,
            "Story.NotFound" => StatusCodes.Status404NotFound,
            "Sprint.NotFound" => StatusCodes.Status404NotFound,
            "AI.RequestNotFound" => StatusCodes.Status404NotFound,
            "AI.InvalidDescription" => StatusCodes.Status422UnprocessableEntity,
            "AI.InvalidProjectName" => StatusCodes.Status422UnprocessableEntity,
            "AI.MissingAcceptanceCriteria" => StatusCodes.Status422UnprocessableEntity,
            "AI.InvalidPayload" => StatusCodes.Status422UnprocessableEntity,
            "AI.EmptyResult" => StatusCodes.Status422UnprocessableEntity,
            "AI.RequestAlreadyApplied" => StatusCodes.Status409Conflict,
            "AI.ProviderFailed" => StatusCodes.Status502BadGateway,
            "Project.InvalidEnvironmentType" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record ClarifyBodyDto(string? Description, string? EnvironmentType);
public record ClarifyResponseDto(IReadOnlyList<string> Questions);

public record GenerateProjectBodyDto(
    string? Description,
    string? EnvironmentType,
    IReadOnlyList<AIClarificationAnswerDto>? Clarifications);

public record ApplyGenerationBodyDto(
    string? ProjectName,
    string? EnvironmentType,
    IReadOnlyList<AIGeneratedEpicDto>? Epics);
