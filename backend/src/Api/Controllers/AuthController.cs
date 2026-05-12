using System.Security.Claims;
using Application.Common;
using Application.Features.Auth;
using Application.Features.Auth.Commands;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
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

    [HttpGet("/api/v1/users/me")]
    [Authorize]
    public ActionResult Me()
    {
        return Ok(new
        {
            id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"),
            email = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email"),
            name = User.FindFirstValue("name")
        });
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.EmailAlreadyRegistered" => StatusCodes.Status409Conflict,
            "Auth.InvalidCredentials" => StatusCodes.Status401Unauthorized,
            "Auth.InvalidRefreshToken" => StatusCodes.Status401Unauthorized,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}
