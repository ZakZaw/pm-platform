using Api.Authorization;
using Application.Common;
using Application.Features.AI;
using Application.Features.AI.Commands;
using Application.Features.AI.Queries;
using Application.Features.Epics;
using Application.Features.Projects;
using Application.Features.Tasks;
using Domain.Enums;
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
            body.Description ?? string.Empty, body.Type ?? "Engineering"), ct);
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
            body.Type ?? "Engineering",
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
            body.Type ?? "Engineering",
            body.Epics ?? Array.Empty<AIGeneratedEpicDto>()), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // F1.5-07 — apply endpoint for non-Engineering AI drafts. The draft
    // stays canonical on the server (stored in AIGenerationRequest.PreviewJson),
    // so the wizard only needs to send the chosen project name.
    [HttpPost("api/v1/ai/generate-typed-project/{requestId:guid}/apply")]
    public async Task<ActionResult<ProjectDto>> ApplyTypedGeneratedProject(
        Guid requestId,
        [FromBody] ApplyTypedGenerationBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new ApplyTypedProjectGenerationCommand(
            requestId, body.ProjectName ?? string.Empty), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/tasks/{taskId:guid}/estimate")]
    public async Task<ActionResult<TaskEstimateDto>> Estimate(
        Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new EstimateTaskPointsCommand(taskId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/tasks/{taskId:guid}/ai/breakdown")]
    public async Task<ActionResult<TaskBreakdownDto>> BreakdownTask(
        Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new BreakdownTaskCommand(taskId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/ai/generate-epic")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<AIGeneratedEpicDto>> GenerateEpic(
        Guid projectId, [FromBody] GenerateEpicBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new GenerateEpicPreviewCommand(
            projectId, body.Description ?? string.Empty), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/ai/apply-epic")]
    [RequireProjectRole(ProjectRole.TeamLead)]
    public async Task<ActionResult<EpicDto>> ApplyEpic(
        Guid projectId, [FromBody] ApplyEpicBodyDto body, CancellationToken ct)
    {
        if (body.Epic is null)
            return ToProblem(AIErrors.InvalidPayload);
        var result = await mediator.Send(new ApplyEpicGenerationCommand(projectId, body.Epic), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/ai/generate-tasks")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<ActionResult<AIGeneratedTaskListDto>> GenerateTasks(
        Guid projectId, [FromBody] GenerateTasksBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new GenerateTaskListCommand(
            projectId, body.EpicId, body.Description ?? string.Empty, body.MaxTasks), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/ai/apply-tasks")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<ActionResult<IReadOnlyList<TaskDto>>> ApplyTasks(
        Guid projectId, [FromBody] ApplyTasksBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new ApplyTaskListCommand(
            projectId, body.EpicId, body.Tasks ?? Array.Empty<AIGeneratedTaskDto>()), ct);
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

    [HttpGet("api/v1/projects/{projectId:guid}/ai/suggestions")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<IReadOnlyList<AISuggestionDto>>> ListSuggestions(
        Guid projectId, [FromQuery] bool includeActed = false, CancellationToken ct = default)
    {
        var result = await mediator.Send(new ListProjectSuggestionsQuery(projectId, includeActed), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/ai/suggestions/sprint-health")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<ActionResult<AISuggestionDto>> GenerateSprintHealth(
        Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new GenerateSprintHealthInsightCommand(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/ai/suggestions/{id:guid}/dismiss")]
    public async Task<IActionResult> DismissSuggestion(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DismissSuggestionCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/ai/suggestions/{id:guid}/accept")]
    public async Task<IActionResult> AcceptSuggestion(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new AcceptSuggestionCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Org.NotFound" => StatusCodes.Status404NotFound,
            "Task.NotFound" => StatusCodes.Status404NotFound,
            "Sprint.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotAMember" => StatusCodes.Status403Forbidden,
            "Project.InsufficientRole" => StatusCodes.Status403Forbidden,
            "AI.RequestNotFound" => StatusCodes.Status404NotFound,
            "AI.InvalidDescription" => StatusCodes.Status422UnprocessableEntity,
            "AI.InvalidProjectName" => StatusCodes.Status422UnprocessableEntity,
            "AI.MissingAcceptanceCriteria" => StatusCodes.Status422UnprocessableEntity,
            "AI.InvalidPayload" => StatusCodes.Status422UnprocessableEntity,
            "AI.EmptyResult" => StatusCodes.Status422UnprocessableEntity,
            "AI.RequestAlreadyApplied" => StatusCodes.Status409Conflict,
            "AI.ProviderFailed" => StatusCodes.Status502BadGateway,
            "AI.NotConfigured" => StatusCodes.Status503ServiceUnavailable,
            "Project.InvalidType" => StatusCodes.Status422UnprocessableEntity,
            "Task.InvalidTitle" => StatusCodes.Status422UnprocessableEntity,
            "Task.EpicNotInProject" => StatusCodes.Status422UnprocessableEntity,
            "Epic.InvalidTitle" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record ClarifyBodyDto(string? Description, string? Type);
public record ClarifyResponseDto(IReadOnlyList<string> Questions);

public record GenerateProjectBodyDto(
    string? Description,
    string? Type,
    IReadOnlyList<AIClarificationAnswerDto>? Clarifications);

public record ApplyGenerationBodyDto(
    string? ProjectName,
    string? Type,
    IReadOnlyList<AIGeneratedEpicDto>? Epics);

public record ApplyTypedGenerationBodyDto(string? ProjectName);

public record GenerateEpicBodyDto(string? Description);
public record ApplyEpicBodyDto(AIGeneratedEpicDto? Epic);
public record GenerateTasksBodyDto(string? Description, Guid? EpicId, int? MaxTasks);
public record ApplyTasksBodyDto(Guid? EpicId, IReadOnlyList<AIGeneratedTaskDto>? Tasks);
