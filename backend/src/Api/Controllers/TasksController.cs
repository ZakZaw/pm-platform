using Application.Common;
using Application.Features.Tasks;
using Application.Features.Tasks.Commands;
using Application.Features.Tasks.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class TasksController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/projects/{projectId:guid}/tasks")]
    public async Task<ActionResult<IReadOnlyList<TaskDto>>> ListForProject(
        Guid projectId,
        [FromQuery(Name = "epic_id")] Guid? epicId = null,
        [FromQuery(Name = "sprint_id")] Guid? sprintId = null,
        [FromQuery(Name = "assignee_id")] Guid? assigneeId = null,
        [FromQuery(Name = "include_done")] bool includeDone = false,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(
            new ListProjectTasksQuery(projectId, epicId, sprintId, assigneeId, includeDone), ct);
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
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

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
