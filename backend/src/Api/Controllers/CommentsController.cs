using Application.Common;
using Application.Features.Comments;
using Application.Features.Comments.Commands;
using Application.Features.Comments.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class CommentsController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/tasks/{taskId:guid}/comments")]
    public async Task<ActionResult<IReadOnlyList<CommentDto>>> ListForTask(
        Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListTaskCommentsQuery(taskId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/tasks/{taskId:guid}/comments")]
    public async Task<ActionResult<CommentDto>> Create(
        Guid taskId,
        [FromBody] CreateCommentBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new CreateCommentCommand(taskId, body.BodyMd ?? string.Empty, body.MentionedUserIds), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/comments/{id:guid}")]
    public async Task<ActionResult<CommentDto>> Update(
        Guid id,
        [FromBody] UpdateCommentBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new UpdateCommentCommand(id, body.BodyMd ?? string.Empty), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/comments/{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteCommentCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/projects/{projectId:guid}/mentionable-users")]
    public async Task<ActionResult<IReadOnlyList<MentionableUserDto>>> Mentionable(
        Guid projectId,
        [FromQuery(Name = "q")] string? query,
        CancellationToken ct)
    {
        var result = await mediator.Send(new ListMentionableUsersQuery(projectId, query), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Task.NotFound" => StatusCodes.Status404NotFound,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Comment.NotFound" => StatusCodes.Status404NotFound,
            "Comment.Forbidden" => StatusCodes.Status403Forbidden,
            "Comment.InvalidBody" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateCommentBodyDto(string? BodyMd, IReadOnlyList<Guid>? MentionedUserIds);
public record UpdateCommentBodyDto(string? BodyMd);
