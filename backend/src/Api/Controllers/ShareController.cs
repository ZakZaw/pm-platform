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
    [HttpGet("api/v1/share/roadmap/{token}")]
    public async Task<ActionResult<PublicRoadmapDto>> GetRoadmap(
        string token,
        [FromQuery] string? password = null,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetPublicRoadmapQuery(token, password), ct);
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
            "Project.NotFound" => StatusCodes.Status404NotFound,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}
