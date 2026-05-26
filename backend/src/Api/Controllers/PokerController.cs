using Application.Common;
using Application.Features.Poker;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
public class PokerController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/tasks/{taskId:guid}/poker")]
    public async Task<ActionResult<PokerSessionDto?>> GetActive(Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new GetActivePokerSessionQuery(taskId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/tasks/{taskId:guid}/poker")]
    public async Task<ActionResult<PokerSessionDto>> Start(Guid taskId, CancellationToken ct)
    {
        var result = await mediator.Send(new StartPokerSessionCommand(taskId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/poker/{sessionId:guid}/votes")]
    public async Task<ActionResult<PokerSessionDto>> Vote(
        Guid sessionId, [FromBody] CastVoteBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new CastPokerVoteCommand(sessionId, body.Value), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/poker/{sessionId:guid}/reveal")]
    public async Task<ActionResult<PokerSessionDto>> Reveal(Guid sessionId, CancellationToken ct)
    {
        var result = await mediator.Send(new RevealPokerSessionCommand(sessionId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/poker/{sessionId:guid}/close")]
    public async Task<ActionResult<PokerSessionDto>> Close(
        Guid sessionId, [FromBody] ClosePokerBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new ClosePokerSessionCommand(
            sessionId, body.FinalEstimate, body.ApplyToTask ?? false), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Task.NotFound" => StatusCodes.Status404NotFound,
            "Poker.NotFound" => StatusCodes.Status404NotFound,
            "Poker.AlreadyOpen" => StatusCodes.Status409Conflict,
            "Poker.NotVoting" => StatusCodes.Status409Conflict,
            "Poker.NotRevealable" => StatusCodes.Status409Conflict,
            "Poker.AlreadyClosed" => StatusCodes.Status409Conflict,
            "Poker.InvalidValue" => StatusCodes.Status422UnprocessableEntity,
            "Poker.HostOnly" => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CastVoteBodyDto(string Value);
public record ClosePokerBodyDto(int? FinalEstimate, bool? ApplyToTask);
