using Application.Features.Integrations;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// F2-23 — inbound source-control webhooks. Anonymous by design (the
/// caller is GitHub, not a logged-in user); authenticity is enforced
/// by HMAC-SHA256 verification inside the processing command against
/// the per-integration secret. We read the raw body bytes ourselves so
/// the signature is computed over exactly what GitHub sent.
/// </summary>
[ApiController]
[AllowAnonymous]
public class WebhooksController(ISender mediator) : ControllerBase
{
    [HttpPost("api/v1/webhooks/github")]
    public async Task<IActionResult> GitHub(CancellationToken ct)
    {
        using var ms = new MemoryStream();
        await Request.Body.CopyToAsync(ms, ct);
        var body = ms.ToArray();

        var eventType = Request.Headers["X-GitHub-Event"].ToString();
        var signature = Request.Headers["X-Hub-Signature-256"].ToString();

        var result = await mediator.Send(
            new ProcessGitHubWebhookCommand(eventType, body, signature), ct);

        // 401 on a bad signature; otherwise ack so GitHub stops retrying.
        if (!result.IsSuccess && result.Error?.Code == "Integration.InvalidSignature")
            return Unauthorized();
        return NoContent();
    }
}
