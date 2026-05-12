using System.Security.Claims;
using Application.Common;
using Application.Features.Organizations;
using Application.Features.Organizations.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/users")]
public class UsersController(ISender mediator) : ControllerBase
{
    [HttpGet("me")]
    public ActionResult Me()
    {
        return Ok(new
        {
            id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"),
            email = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email"),
            name = User.FindFirstValue("name")
        });
    }

    [HttpGet("me/orgs")]
    public async Task<ActionResult<IReadOnlyList<OrgSummary>>> MyOrgs(CancellationToken ct)
    {
        var result = await mediator.Send(new GetMyOrganizationsQuery(), ct);
        if (result.IsSuccess) return Ok(result.Value);
        return Problem(title: result.Error!.Code, detail: result.Error.Message, statusCode: StatusCodes.Status401Unauthorized);
    }
}
