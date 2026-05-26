using Application.Common;
using Application.Features.Labels;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class LabelsController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/projects/{projectId:guid}/labels")]
    public async Task<ActionResult<IReadOnlyList<LabelDto>>> List(Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListProjectLabelsQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/labels")]
    public async Task<ActionResult<LabelDto>> Create(
        Guid projectId, [FromBody] CreateLabelBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateLabelCommand(projectId, body.Name, body.Color), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/labels/{labelId:guid}")]
    public async Task<ActionResult<LabelDto>> Update(
        Guid labelId, [FromBody] UpdateLabelBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateLabelCommand(labelId, body.Name, body.Color), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/labels/{labelId:guid}")]
    public async Task<ActionResult> Delete(Guid labelId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteLabelCommand(labelId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/tasks/{taskId:guid}/labels")]
    public async Task<ActionResult<IReadOnlyList<LabelDto>>> ListForTask(
        Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListTaskLabelsQuery(taskId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPut("api/v1/tasks/{taskId:guid}/labels")]
    public async Task<ActionResult<IReadOnlyList<LabelDto>>> SetForTask(
        Guid taskId, [FromBody] SetTaskLabelsBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new SetTaskLabelsCommand(taskId, body.LabelIds ?? []), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Task.NotFound" => StatusCodes.Status404NotFound,
            "Label.NotFound" => StatusCodes.Status404NotFound,
            "Label.DuplicateName" => StatusCodes.Status409Conflict,
            "Label.InvalidName" => StatusCodes.Status422UnprocessableEntity,
            "Label.InvalidColor" => StatusCodes.Status422UnprocessableEntity,
            "Label.NotInProject" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateLabelBodyDto(string Name, string Color);
public record UpdateLabelBodyDto(string? Name, string? Color);
public record SetTaskLabelsBodyDto(IReadOnlyList<Guid>? LabelIds);
