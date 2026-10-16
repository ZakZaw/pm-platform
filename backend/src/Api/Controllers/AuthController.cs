using Microsoft.AspNetCore.Authorization;
using Api.Authorization;
using Api.Middleware;
using Microsoft.AspNetCore.RateLimiting;
using Application.Common;
using Application.Features.Auth;
using Application.Features.Auth.Commands;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
[EnableRateLimiting(RateLimitPolicies.Auth)]
public class AuthController(ISender mediator) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterCommand command, CancellationToken ct)
    {
        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginCommand command, CancellationToken ct)
    {
        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh([FromBody] RefreshTokenCommand command, CancellationToken ct)
    {
        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    // M5 - server-side sign-out. The refresh token is the credential (the
    // access token may already have expired), so no [Authorize].
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutCommand command, CancellationToken ct)
    {
        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    // M5 - revoke every session of the signed-in user.
    [HttpPost("logout-all")]
    [Authorize]
    [DenyApiKey]
    public async Task<IActionResult> LogoutAll(CancellationToken ct)
    {
        var result = await mediator.Send(new LogoutAllCommand(), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.EmailAlreadyRegistered" => StatusCodes.Status409Conflict,
            "Auth.InvalidCredentials" => StatusCodes.Status401Unauthorized,
            "Auth.InvalidRefreshToken" => StatusCodes.Status401Unauthorized,
            "Auth.AccountLocked" => StatusCodes.Status429TooManyRequests,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}
