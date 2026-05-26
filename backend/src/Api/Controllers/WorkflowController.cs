using Application.Common;
using Application.Features.Workflow;
using Application.Features.Workflow.Commands;
using Application.Features.Workflow.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/projects/{projectId:guid}/status-config")]
public class WorkflowController(ISender mediator) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StatusConfigDto>>> List(
        Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListProjectStatusConfigQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost]
    public async Task<ActionResult<StatusConfigDto>> Create(
        Guid projectId,
        [FromBody] CreateStatusConfigBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new CreateStatusConfigCommand(
            projectId, body.BaseStatus ?? string.Empty, body.DisplayName ?? string.Empty,
            body.Color, body.IsDoneState ?? false), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("{configId:guid}")]
    public async Task<ActionResult> Delete(
        Guid projectId, Guid configId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteStatusConfigCommand(projectId, configId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPatch("{configId:guid}")]
    public async Task<ActionResult<StatusConfigDto>> Update(
        Guid projectId,
        Guid configId,
        [FromBody] UpdateStatusConfigBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateStatusConfigCommand(
            projectId, configId, body.DisplayName, body.Color, body.IsDoneState, body.IsVisible,
            body.WipLimit, body.ClearWipLimit ?? false), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("reorder")]
    public async Task<ActionResult<IReadOnlyList<StatusConfigDto>>> Reorder(
        Guid projectId,
        [FromBody] ReorderStatusConfigBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new ReorderStatusConfigCommand(
            projectId, body.OrderedConfigIds ?? Array.Empty<Guid>()), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Workflow.ConfigNotFound" => StatusCodes.Status404NotFound,
            "Workflow.NeedOneDoneState" => StatusCodes.Status422UnprocessableEntity,
            "Workflow.ColumnNotEmpty" => StatusCodes.Status422UnprocessableEntity,
            "Task.InvalidStatus" => StatusCodes.Status422UnprocessableEntity,
            "Workflow.InvalidDisplayName" => StatusCodes.Status422UnprocessableEntity,
            "Workflow.InvalidColor" => StatusCodes.Status422UnprocessableEntity,
            "Workflow.InvalidReorder" => StatusCodes.Status422UnprocessableEntity,
            "WipLimit.Invalid" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record UpdateStatusConfigBodyDto(
    string? DisplayName,
    string? Color,
    bool? IsDoneState,
    bool? IsVisible,
    int? WipLimit,
    bool? ClearWipLimit);

public record ReorderStatusConfigBodyDto(IReadOnlyList<Guid>? OrderedConfigIds);

public record CreateStatusConfigBodyDto(
    string? BaseStatus,
    string? DisplayName,
    string? Color,
    bool? IsDoneState);
