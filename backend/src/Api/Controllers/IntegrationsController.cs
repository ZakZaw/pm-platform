using Application.Common;
using Application.Features.Integrations;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// F2-23 — GitHub source-control integration. Per-project list +
/// connect (OAuth) + disconnect. The OAuth callback is the one
/// anonymous action: GitHub redirects the browser there with no JWT,
/// so trust comes from the signed <c>state</c> instead.
/// </summary>
[ApiController]
[Authorize]
public class IntegrationsController(ISender mediator, IConfiguration config) : ControllerBase
{
    [HttpGet("api/v1/projects/{projectId:guid}/integrations")]
    public async Task<ActionResult<IReadOnlyList<IntegrationDto>>> List(
        Guid projectId, CancellationToken ct)
    {
        var result = await mediator.Send(new ListProjectIntegrationsQuery(projectId), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/projects/{projectId:guid}/integrations/github/authorize")]
    public async Task<ActionResult<GitHubAuthorizeDto>> Authorize(
        Guid projectId,
        [FromQuery] string repo,
        [FromQuery(Name = "return_path")] string? returnPath,
        CancellationToken ct)
    {
        var result = await mediator.Send(
            new GetGitHubAuthorizeUrlQuery(projectId, repo ?? string.Empty, returnPath), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [AllowAnonymous]
    [HttpGet("api/v1/integrations/github/callback")]
    public async Task<IActionResult> Callback(
        [FromQuery] string? code, [FromQuery] string? state, CancellationToken ct)
    {
        var result = await mediator.Send(new CompleteGitHubOAuthCommand(code, state), ct);
        var frontendBase = (config["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');

        if (!result.IsSuccess)
        {
            // Bounce back to the app with an error flag; we can't trust an
            // arbitrary return path on failure, so land on the root.
            return Redirect($"{frontendBase}/?github=error");
        }

        var path = result.Value!.ReturnPath;
        var sep = path.Contains('?') ? '&' : '?';
        return Redirect($"{frontendBase}{path}{sep}github=connected");
    }

    [HttpDelete("api/v1/integrations/{id:guid}")]
    public async Task<IActionResult> Disconnect(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DisconnectIntegrationCommand(id), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            "Integration.NotFound" => StatusCodes.Status404NotFound,
            "Integration.Forbidden" => StatusCodes.Status403Forbidden,
            "Integration.NotConfigured" => StatusCodes.Status503ServiceUnavailable,
            "Integration.InvalidRepo" => StatusCodes.Status422UnprocessableEntity,
            "Integration.RepoAlreadyLinked" => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest,
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}
