using Application.Common;
using Application.Features.Organizations;
using Application.Features.Organizations.Queries;
using Application.Features.Users;
using Application.Features.Users.Commands;
using Application.Features.Users.Queries;
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
    public async Task<ActionResult<UserProfileDto>> Me(CancellationToken ct)
    {
        var result = await mediator.Send(new GetMyProfileQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("me")]
    public async Task<ActionResult<UserProfileDto>> UpdateMe(
        [FromBody] UpdateMyProfileBodyDto body,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateMyProfileCommand(
            body.FullName,
            body.Timezone,
            body.SkillTags ?? [],
            body.CapacityHoursPerWeek), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPost("me/avatar")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<ActionResult<UserProfileDto>> UploadAvatar(
        [FromForm] UploadAvatarFormDto form,
        CancellationToken ct)
    {
        if (form.Avatar is not { Length: > 0 } file)
            return ToProblem(UserErrors.AvatarInvalidType);

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);

        var result = await mediator.Send(new UploadMyAvatarCommand(
            ms.ToArray(),
            file.ContentType,
            file.FileName), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("me/orgs")]
    public async Task<ActionResult<IReadOnlyList<OrgSummary>>> MyOrgs(CancellationToken ct)
    {
        var result = await mediator.Send(new GetMyOrganizationsQuery(), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "User.NotFound" => StatusCodes.Status404NotFound,
            "User.AvatarTooLarge" => StatusCodes.Status413PayloadTooLarge,
            "User.AvatarInvalidType" => StatusCodes.Status415UnsupportedMediaType,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record UpdateMyProfileBodyDto(
    string FullName,
    string Timezone,
    string[]? SkillTags,
    int CapacityHoursPerWeek);

public record UploadAvatarFormDto(IFormFile? Avatar);
