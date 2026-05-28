using Api.Authorization;
using Application.Common;
using Application.Features.Tasks;
using Application.Features.Tasks.Commands;
using Application.Features.Tasks.Queries;
using Domain.Enums;
using Infrastructure.Services;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class TasksController(ISender mediator, IOptions<FrontendSettings> frontend) : ControllerBase
{
    [HttpGet("api/v1/projects/{projectId:guid}/tasks")]
    public async Task<ActionResult<IReadOnlyList<TaskDto>>> ListForProject(
        Guid projectId,
        [FromQuery(Name = "epic_id")] Guid? epicId = null,
        [FromQuery(Name = "sprint_id")] Guid? sprintId = null,
        [FromQuery(Name = "assignee_id")] Guid? assigneeId = null,
        [FromQuery(Name = "include_done")] bool includeDone = false,
        [FromQuery] string[]? status = null,
        [FromQuery] string[]? priority = null,
        [FromQuery] string? search = null,
        [FromQuery(Name = "no_epic")] bool? noEpic = null,
        [FromQuery(Name = "no_sprint")] bool? noSprint = null,
        [FromQuery(Name = "no_assignee")] bool? noAssignee = null,
        [FromQuery(Name = "due_after")] DateTime? dueAfter = null,
        [FromQuery(Name = "due_before")] DateTime? dueBefore = null,
        [FromQuery] string? sort = null,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(
            new ListProjectTasksQuery(
                projectId, epicId, sprintId, assigneeId, includeDone,
                status, priority, search,
                noEpic, noSprint, noAssignee,
                dueAfter, dueBefore, sort), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/projects/{projectId:guid}/tasks")]
    public async Task<ActionResult<TaskDto>> Create(
        Guid projectId,
        [FromBody] CreateTaskBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new CreateTaskCommand(
            projectId, body.EpicId, body.SprintId,
            body.Title, body.Description, body.Priority, body.StoryPoints,
            body.AssigneeId, body.ReviewerId, body.DueDate,
            body.AcceptanceCriteria), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/tasks/{id:guid}")]
    public async Task<ActionResult<TaskDto>> Get(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetTaskQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // F2-18 — resolve a display key like "AT-247" inside an org.
    // Powers the [[task:KEY]] embed in chat messages.
    [HttpGet("api/v1/orgs/{slug}/tasks/by-key/{key}")]
    public async Task<ActionResult<TaskDto>> GetByKey(
        string slug, string key, CancellationToken ct)
    {
        var result = await mediator.Send(new GetTaskByKeyQuery(slug, key), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/tasks/{id:guid}")]
    public async Task<ActionResult<TaskDto>> Update(
        Guid id,
        [FromBody] UpdateTaskBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateTaskCommand(
            id, body.Title, body.Description, body.Priority, body.StoryPoints,
            body.EpicId, body.ClearEpic ?? false,
            body.SprintId, body.ClearSprint ?? false,
            body.AssigneeId, body.ClearAssignee ?? false,
            body.ReviewerId, body.ClearReviewer ?? false,
            body.DueDate, body.ClearDueDate ?? false,
            body.TimeLoggedMinutes, body.PrUrl,
            body.AcceptanceCriteria), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/tasks/{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteTaskCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/tasks/{id:guid}/status")]
    public async Task<ActionResult<TaskDto>> ChangeStatus(
        Guid id,
        [FromBody] ChangeTaskStatusBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateTaskStatusCommand(id, body.To, body.Reason), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/projects/{projectId:guid}/calendar.ics")]
    [RequireProjectRole(ProjectRole.Viewer)]
    public async Task<IActionResult> Calendar(Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(
            new GetProjectIcalQuery(projectId, frontend.Value.BaseUrl), ct);
        if (!result.IsSuccess) return ToProblem(result.Error!);
        var bytes = System.Text.Encoding.UTF8.GetBytes(result.Value!);
        return File(bytes, "text/calendar; charset=utf-8", "project-calendar.ics");
    }

    [HttpPost("api/v1/projects/{projectId:guid}/tasks/bulk")]
    public async Task<ActionResult<BulkUpdateTasksResult>> Bulk(
        Guid projectId,
        [FromBody] BulkUpdateTasksBodyDto body,
        CancellationToken ct)
    {
        var payload = body.Payload is null ? null : new BulkOperationPayload(
            body.Payload.Status, body.Payload.Reason,
            body.Payload.AssigneeId, body.Payload.ClearAssignee ?? false);

        var result = await mediator.Send(
            new BulkUpdateTasksCommand(projectId, body.TaskIds, body.Operation, payload), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // F2-09 task dependencies — feeds the Task->Done unblock automation.
    [HttpGet("api/v1/tasks/{taskId:guid}/dependencies")]
    public async Task<ActionResult<TaskDependencyListDto>> Dependencies(
        Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListTaskDependenciesQuery(taskId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/tasks/{taskId:guid}/dependencies")]
    public async Task<ActionResult<TaskDependencyDto>> AddDependency(
        Guid taskId,
        [FromBody] AddTaskDependencyBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new AddTaskDependencyCommand(taskId, body.DependsOnTaskId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/tasks/{taskId:guid}/dependencies/{prereqId:guid}")]
    public async Task<ActionResult> RemoveDependency(
        Guid taskId, Guid prereqId, CancellationToken ct)
    {
        var result = await mediator.Send(new RemoveTaskDependencyCommand(taskId, prereqId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Task.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Task.InvalidTransition" => StatusCodes.Status422UnprocessableEntity,
            "Task.NoOpTransition" => StatusCodes.Status422UnprocessableEntity,
            "Task.ReasonRequired" => StatusCodes.Status422UnprocessableEntity,
            "Task.PersonalAssigneeLocked" => StatusCodes.Status403Forbidden,
            "Task.DependencyCycle" => StatusCodes.Status409Conflict,
            "Task.DependencyNotInProject" => StatusCodes.Status422UnprocessableEntity,
            "Task.DependencyNotFound" => StatusCodes.Status404NotFound,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record AddTaskDependencyBodyDto(Guid DependsOnTaskId);

public record CreateTaskBodyDto(
    string Title,
    string? Description,
    string? Priority,
    int? StoryPoints,
    Guid? EpicId,
    Guid? SprintId,
    Guid? AssigneeId,
    Guid? ReviewerId,
    DateTime? DueDate,
    string[]? AcceptanceCriteria);

public record UpdateTaskBodyDto(
    string? Title,
    string? Description,
    string? Priority,
    int? StoryPoints,
    Guid? EpicId,
    bool? ClearEpic,
    Guid? SprintId,
    bool? ClearSprint,
    Guid? AssigneeId,
    bool? ClearAssignee,
    Guid? ReviewerId,
    bool? ClearReviewer,
    DateTime? DueDate,
    bool? ClearDueDate,
    int? TimeLoggedMinutes,
    string? PrUrl,
    string[]? AcceptanceCriteria);

public record ChangeTaskStatusBodyDto(string To, string? Reason);

public record BulkUpdateTasksBodyDto(
    IReadOnlyList<Guid> TaskIds,
    string Operation,
    BulkOperationPayloadDto? Payload);

public record BulkOperationPayloadDto(
    string? Status,
    string? Reason,
    Guid? AssigneeId,
    bool? ClearAssignee);
