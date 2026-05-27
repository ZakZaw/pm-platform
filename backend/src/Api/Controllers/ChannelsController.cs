using Application.Common;
using Application.Features.Channels;
using Application.Features.Channels.Commands;
using Application.Features.Channels.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class ChannelsController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/orgs/{slug}/channels")]
    public async Task<ActionResult<IReadOnlyList<ChannelListItemDto>>> List(
        string slug,
        [FromQuery(Name = "include_archived")] bool includeArchived = false,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(
            new ListMyChannelsQuery(slug, includeArchived), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/channels/{id:guid}")]
    public async Task<ActionResult<ChannelDetailDto>> Get(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new GetChannelQuery(id), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/orgs/{slug}/channels")]
    public async Task<ActionResult<ChannelDetailDto>> CreateTopic(
        string slug, [FromBody] CreateTopicChannelBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateTopicChannelCommand(
            slug, body.Name ?? string.Empty, body.EpicId, body.MemberIds), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/channels/{id:guid}/members")]
    public async Task<ActionResult<ChannelMemberDto>> AddMember(
        Guid id, [FromBody] AddChannelMemberBodyDto body, CancellationToken ct)
    {
        if (body.UserId == Guid.Empty)
            return ToProblem(OrgErrors.MemberNotFound);
        var result = await mediator.Send(new AddChannelMemberCommand(id, body.UserId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/channels/{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> Leave(Guid id, Guid userId, CancellationToken ct)
    {
        var result = await mediator.Send(new LeaveChannelCommand(id, userId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/channels/{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new MarkChannelReadCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/channels/{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new ArchiveTopicChannelCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Org.NotFound" => StatusCodes.Status404NotFound,
            "Org.MemberNotFound" => StatusCodes.Status404NotFound,
            "Channel.NotFound" => StatusCodes.Status404NotFound,
            "Channel.NotAMember" => StatusCodes.Status403Forbidden,
            "Channel.Archived" => StatusCodes.Status409Conflict,
            "Channel.CannotArchiveSystem" => StatusCodes.Status422UnprocessableEntity,
            "Channel.InvalidScope" => StatusCodes.Status422UnprocessableEntity,
            "Channel.InvalidName" => StatusCodes.Status422UnprocessableEntity,
            "Channel.EpicNotInOrg" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateTopicChannelBodyDto(
    string? Name,
    Guid? EpicId,
    IReadOnlyList<Guid>? MemberIds);

public record AddChannelMemberBodyDto(Guid UserId);
