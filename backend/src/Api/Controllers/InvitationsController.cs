using Api.Authorization;
using Application.Common;
using Application.Features.Invitations;
using Application.Features.Invitations.Commands;
using Application.Features.Invitations.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
public class InvitationsController(ISender mediator) : ControllerBase
{
    [HttpPost("api/v1/orgs/{slug}/invitations")]
    [Authorize]
    [RequireOrgRole(OrgRole.Admin)]
    public async Task<ActionResult<InvitationDto>> Create(
        string slug,
        [FromBody] CreateInvitationBodyDto body,
        CancellationToken ct)
    {
        if (!Enum.TryParse<OrgRole>(body.Role, ignoreCase: true, out var role))
            return ToProblem(InvitationErrors.InvalidRole);

        var result = await mediator.Send(new CreateInvitationCommand(slug, body.Email, role), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("api/v1/invitations/{token}")]
    [AllowAnonymous]
    public async Task<ActionResult<InvitationPreviewDto>> Preview(string token, CancellationToken ct)
    {
        var result = await mediator.Send(new GetInvitationByTokenQuery(token), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("api/v1/invitations/{token}/accept")]
    [Authorize]
    public async Task<ActionResult<AcceptInvitationResultDto>> Accept(string token, CancellationToken ct)
    {
        var result = await mediator.Send(new AcceptInvitationCommand(token), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Org.NotFound" => StatusCodes.Status404NotFound,
            "Invitation.NotFound" => StatusCodes.Status404NotFound,
            "Invitation.Expired" => StatusCodes.Status410Gone,
            "Invitation.AlreadyAccepted" => StatusCodes.Status409Conflict,
            "Invitation.EmailMismatch" => StatusCodes.Status403Forbidden,
            "Invitation.AlreadyMember" => StatusCodes.Status409Conflict,
            "Invitation.DuplicateActive" => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateInvitationBodyDto(string Email, string Role);
