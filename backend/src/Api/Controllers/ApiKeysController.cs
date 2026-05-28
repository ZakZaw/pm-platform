using Application.Common;
using Application.Features.ApiKeys;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// F2-24 — manage public REST API keys for an organization. Owner/Admin
/// only (enforced in the handlers). The secret is returned exactly once,
/// by <see cref="Create"/>.
/// </summary>
[ApiController]
[Authorize]
public class ApiKeysController(ISender mediator) : ControllerBase
{
    [HttpGet("api/v1/orgs/{slug}/api-keys")]
    public async Task<ActionResult<IReadOnlyList<ApiKeyDto>>> List(string slug, CancellationToken ct)
    {
        var result = await mediator.Send(new ListApiKeysQuery(slug), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/orgs/{slug}/api-keys")]
    public async Task<ActionResult<CreatedApiKeyDto>> Create(
        string slug, [FromBody] CreateApiKeyBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(
            new CreateApiKeyCommand(slug, body.Name ?? string.Empty, body.ExpiresInDays), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("api/v1/api-keys/{id:guid}")]
    public async Task<IActionResult> Revoke(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new RevokeApiKeyCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Org.NotFound" => StatusCodes.Status404NotFound,
            "ApiKey.NotFound" => StatusCodes.Status404NotFound,
            "ApiKey.Forbidden" => StatusCodes.Status403Forbidden,
            "ApiKey.InvalidName" => StatusCodes.Status422UnprocessableEntity,
            "ApiKey.AlreadyRevoked" => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateApiKeyBodyDto(string? Name, int? ExpiresInDays);
