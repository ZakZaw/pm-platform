using Api.Authorization;
using Api.Middleware;
using Microsoft.AspNetCore.RateLimiting;
using Application.Common;
using Application.Features.Roadmap.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// Public, no-auth read-only views unlocked by a share-link token. The
/// token itself is the credential; an optional password adds a second
/// factor. Wired up for roadmap share links (F2-06) — other share types
/// can land here later without re-wiring auth.
/// </summary>
[ApiController]
[AllowAnonymous]
public class ShareController(ISender mediator) : ControllerBase
{
    public const string PasswordHeader = "X-Share-Password";

    // M4 - the password never travels in the URL (where it would end up in
    // access logs, proxies and browser history): send it in the
    // X-Share-Password header on GET, or in the body of the POST below.
    [HttpGet("api/v1/share/roadmap/{token}")]
    [EnableRateLimiting(RateLimitPolicies.PublicLink)]
    public async Task<ActionResult<PublicRoadmapDto>> GetRoadmap(
        string token,
        [FromHeader(Name = PasswordHeader)] string? password = null,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetPublicRoadmapQuery(token, password), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/share/roadmap/{token}")]
    [EnableRateLimiting(RateLimitPolicies.PublicLink)]
    public async Task<ActionResult<PublicRoadmapDto>> UnlockRoadmap(
        string token,
        [FromBody] UnlockShareBodyDto body,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetPublicRoadmapQuery(token, body?.Password), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "RoadmapShare.NotFound" => StatusCodes.Status404NotFound,
            "RoadmapShare.Expired" => StatusCodes.Status410Gone,
            "RoadmapShare.Revoked" => StatusCodes.Status410Gone,
            "RoadmapShare.PasswordRequired" => StatusCodes.Status401Unauthorized,
            "RoadmapShare.InvalidPassword" => StatusCodes.Status401Unauthorized,
            "RoadmapShare.PasswordLocked" => StatusCodes.Status429TooManyRequests,
            "Project.NotFound" => StatusCodes.Status404NotFound,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record UnlockShareBodyDto(string? Password);
