using Api.Authorization;
using Application.Common;
using Application.Features.Operations;
using Application.Features.Operations.Commands;
using Application.Features.Operations.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class OperationsController(ISender mediator) : ControllerBase
{
    // ---------- Workflows ----------

    [HttpGet("api/v1/projects/{projectId:guid}/workflows")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<IReadOnlyList<WorkflowDto>>> ListWorkflows(
        Guid projectId,
        [FromQuery] bool includeArchived = false,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new ListWorkflowsQuery(projectId, includeArchived), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/workflows/{workflowId:guid}")]
    public async Task<ActionResult<WorkflowDetailDto>> GetWorkflow(Guid workflowId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetWorkflowQuery(workflowId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/workflows")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<ActionResult<WorkflowDto>> CreateWorkflow(
        Guid projectId, [FromBody] CreateWorkflowBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateWorkflowCommand(
            projectId, body.Name ?? string.Empty, body.Description,
            body.RecurrenceRule, body.OwnerId,
            body.Template ?? []), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/workflows/{workflowId:guid}")]
    public async Task<ActionResult<WorkflowDto>> UpdateWorkflow(
        Guid workflowId, [FromBody] UpdateWorkflowBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateWorkflowCommand(
            workflowId, body.Name, body.Description,
            body.RecurrenceRule, body.ClearRecurrence,
            body.OwnerId, body.ClearOwner,
            body.Template, body.Archive), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/workflows/{workflowId:guid}")]
    public async Task<IActionResult> DeleteWorkflow(Guid workflowId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteWorkflowCommand(workflowId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    // ---------- Runs ----------

    [HttpGet("api/v1/runs/{runId:guid}")]
    public async Task<ActionResult<WorkflowRunDetailDto>> GetRun(Guid runId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetRunQuery(runId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/runs/{runId:guid}/start")]
    public async Task<IActionResult> StartRun(Guid runId, CancellationToken ct)
    {
        var result = await mediator.Send(new StartRunCommand(runId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/runs/{runId:guid}/skip")]
    public async Task<IActionResult> SkipRun(
        Guid runId, [FromBody] SkipRunBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new SkipRunCommand(runId, body.Reason ?? string.Empty), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    // ---------- Checklist items ----------

    [HttpPost("api/v1/checklist-items/{itemId:guid}/toggle")]
    public async Task<IActionResult> ToggleItem(
        Guid itemId, [FromBody] ToggleItemBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new ToggleChecklistItemCommand(itemId, body.Completed), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotAMember" => StatusCodes.Status403Forbidden,
            "Project.InsufficientRole" => StatusCodes.Status403Forbidden,
            "Operations.WorkflowNotFound" => StatusCodes.Status404NotFound,
            "Operations.RunNotFound" => StatusCodes.Status404NotFound,
            "Operations.ChecklistItemNotFound" => StatusCodes.Status404NotFound,
            "Operations.InvalidWorkflowName" => StatusCodes.Status422UnprocessableEntity,
            "Operations.InvalidRecurrence" => StatusCodes.Status422UnprocessableEntity,
            "Operations.InvalidTemplate" => StatusCodes.Status422UnprocessableEntity,
            "Operations.RunAlreadyTerminal" => StatusCodes.Status422UnprocessableEntity,
            "Operations.SkipReasonRequired" => StatusCodes.Status422UnprocessableEntity,
            "Operations.SequentialOrderViolated" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateWorkflowBodyDto(
    string? Name, string? Description, string? RecurrenceRule, Guid? OwnerId,
    IReadOnlyList<ChecklistTemplateItemDto>? Template);

public record UpdateWorkflowBodyDto(
    string? Name, string? Description,
    string? RecurrenceRule, bool ClearRecurrence,
    Guid? OwnerId, bool ClearOwner,
    IReadOnlyList<ChecklistTemplateItemDto>? Template,
    bool? Archive);

public record SkipRunBodyDto(string? Reason);
public record ToggleItemBodyDto(bool Completed);
