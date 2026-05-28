using Application.Common;
using Application.Features.Messages;
using Application.Features.Messages.Commands;
using Application.Features.Messages.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// F2-18 — chat messages, threads, reactions. Lives alongside
/// <see cref="ChannelsController"/>: channels own structure +
/// membership, messages own the conversation itself.
/// </summary>
[ApiController]
[Authorize]
public class MessagesController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/channels/{channelId:guid}/messages")]
    public async Task<ActionResult<ChannelMessagePageDto>> List(
        Guid channelId,
        [FromQuery(Name = "before")] Guid? before,
        [FromQuery] int limit = ListChannelMessagesQueryHandler.DefaultLimit,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new ListChannelMessagesQuery(channelId, before, limit), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/channels/{channelId:guid}/messages")]
    public async Task<ActionResult<MessageDto>> Post(
        Guid channelId, [FromBody] PostMessageBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new PostMessageCommand(
            channelId, body.ParentMessageId, body.BodyMd ?? string.Empty), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("api/v1/messages/{id:guid}")]
    public async Task<ActionResult<MessageDto>> Edit(
        Guid id, [FromBody] EditMessageBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new EditMessageCommand(id, body.BodyMd ?? string.Empty), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/messages/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteMessageCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/messages/{id:guid}/reactions")]
    public async Task<ActionResult<ToggleReactionResult>> Toggle(
        Guid id, [FromBody] ToggleReactionBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new ToggleReactionCommand(id, body.Emoji ?? string.Empty), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/messages/{id:guid}/thread")]
    public async Task<ActionResult<ThreadDto>> Thread(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetThreadQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Channel.NotFound" => StatusCodes.Status404NotFound,
            "Channel.NotAMember" => StatusCodes.Status403Forbidden,
            "Channel.Archived" => StatusCodes.Status409Conflict,
            "Message.NotFound" => StatusCodes.Status404NotFound,
            "Message.NotAuthor" => StatusCodes.Status403Forbidden,
            "Message.AlreadyDeleted" => StatusCodes.Status409Conflict,
            "Message.EmptyBody" => StatusCodes.Status422UnprocessableEntity,
            "Message.TooLong" => StatusCodes.Status422UnprocessableEntity,
            "Message.CannotThreadReply" => StatusCodes.Status422UnprocessableEntity,
            "Message.InvalidEmoji" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record PostMessageBodyDto(Guid? ParentMessageId, string? BodyMd);
public record EditMessageBodyDto(string? BodyMd);
public record ToggleReactionBodyDto(string? Emoji);
