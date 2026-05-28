using Application.Features.Meetings.Commands;
using Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// F2-20 — endpoint LiveKit posts room / participant / egress events
/// to. Authentication is the LiveKit-issued JWT in the Authorization
/// header, validated by <see cref="IVideoService.VerifyWebhookSignature"/>;
/// failure returns 401 and the command never runs.
/// </summary>
[ApiController]
[AllowAnonymous]
public class VideoWebhookController(
    ISender mediator, IVideoService video) : ControllerBase
{
    [HttpPost("api/v1/video/webhook")]
    public async Task<IActionResult> Post(CancellationToken ct)
    {
        // LiveKit signs the raw request body, so we need to read it
        // verbatim before model-binding chews on it.
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(ct);
        var auth = Request.Headers.Authorization.ToString();
        try
        {
            video.VerifyWebhookSignature(auth, body);
        }
        catch
        {
            return Unauthorized();
        }
        var result = await mediator.Send(new HandleVideoWebhookCommand(body), ct);
        return result.IsSuccess ? NoContent() : NoContent();
    }
}
