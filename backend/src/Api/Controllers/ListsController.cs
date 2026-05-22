using Api.Authorization;
using Application.Common;
using Application.Features.Lists;
using Application.Features.Lists.Commands;
using Application.Features.Lists.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class ListsController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/projects/{projectId:guid}/lists-view")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<ActionResult<TaskListsViewDto>> GetView(
        Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetTaskListsViewQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/lists")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<ActionResult<TaskListDto>> Create(
        Guid projectId, [FromBody] CreateListBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(
            new CreateTaskListCommand(projectId, body.Name ?? string.Empty), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/lists/{listId:guid}")]
    public async Task<ActionResult<TaskListDto>> Update(
        Guid listId, [FromBody] UpdateListBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateTaskListCommand(listId, body.Name), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/lists/{listId:guid}")]
    public async Task<IActionResult> Delete(Guid listId, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteTaskListCommand(listId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/lists/reorder")]
    [RequireProjectRole(ProjectRole.Contributor)]
    public async Task<IActionResult> Reorder(
        Guid projectId, [FromBody] ReorderListsBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(
            new ReorderTaskListsCommand(projectId, body.OrderedListIds ?? []), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/tasks/{taskId:guid}/move-to-list")]
    public async Task<IActionResult> MoveTask(
        Guid taskId, [FromBody] MoveToListBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(
            new MoveTaskToListCommand(taskId, body.ListId), ct);
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
            "Task.NotFound" => StatusCodes.Status404NotFound,
            "TaskList.NotFound" => StatusCodes.Status404NotFound,
            "TaskList.NotInProject" => StatusCodes.Status422UnprocessableEntity,
            "TaskList.InvalidName" => StatusCodes.Status422UnprocessableEntity,
            "TaskList.EmptyReorder" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateListBodyDto(string? Name);
public record UpdateListBodyDto(string? Name);
public record ReorderListsBodyDto(IReadOnlyList<Guid>? OrderedListIds);
public record MoveToListBodyDto(Guid? ListId);
