using Api.Authorization;
using Application.Common;
using Application.Features.Organizations;
using Application.Features.Organizations.Commands;
using Application.Features.Organizations.Members;
using Application.Features.Organizations.Members.Commands;
using Application.Features.Organizations.Members.Queries;
using Application.Features.Organizations.Queries;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/orgs")]
public class OrgsController(ISender mediator) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<ActionResult<OrganizationDto>> Create(
        [FromForm] CreateOrgFormDto form,
        CancellationToken ct)
    {
        byte[]? logoBytes = null;
        string? logoContentType = null;
        string? logoFileName = null;

        if (form.Logo is { Length: > 0 } logo)
        {
            using var ms = new MemoryStream();
            await logo.CopyToAsync(ms, ct);
            logoBytes = ms.ToArray();
            logoContentType = logo.ContentType;
            logoFileName = logo.FileName;
        }

        var result = await mediator.Send(
            new CreateOrganizationCommand(form.Name, logoBytes, logoContentType, logoFileName),
            ct);

        return result.IsSuccess
            ? CreatedAtAction(nameof(GetBySlug), new { slug = result.Value!.Slug }, result.Value)
            : ToProblem(result.Error!);
    }

    [HttpGet("{slug}")]
    [RequireOrgRole(OrgRole.Member)]
    public async Task<ActionResult<OrganizationDto>> GetBySlug(string slug, CancellationToken ct)
    {
        var result = await mediator.Send(new GetOrganizationBySlugQuery(slug), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("{slug}")]
    [RequireOrgRole(OrgRole.Admin)]
    public async Task<ActionResult<OrganizationDto>> Update(string slug, [FromBody] UpdateOrgBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new UpdateOrganizationCommand(slug, body.Name), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPut("{slug}/sso")]
    [RequireOrgRole(OrgRole.Owner)]
    public async Task<ActionResult<OrganizationDto>> SetSso(string slug, [FromBody] SetSsoBodyDto body, CancellationToken ct)
    {
        var result = await mediator.Send(new SetOrgSsoCommand(slug, body.Enabled), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpGet("{slug}/members")]
    [RequireOrgRole(OrgRole.Member)]
    public async Task<ActionResult<OrgMembersPage>> ListMembers(
        string slug,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? role = null,
        CancellationToken ct = default)
    {
        OrgRole? roleFilter = null;
        if (!string.IsNullOrWhiteSpace(role))
        {
            if (!Enum.TryParse<OrgRole>(role, ignoreCase: true, out var parsed))
                return ToProblem(OrgErrors.InvalidRole);
            roleFilter = parsed;
        }

        var result = await mediator.Send(new ListOrgMembersQuery(slug, page, pageSize, search, roleFilter), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpPatch("{slug}/members/{userId:guid}/role")]
    [RequireOrgRole(OrgRole.Admin)]
    public async Task<ActionResult<OrgMemberDto>> UpdateMemberRole(
        string slug,
        Guid userId,
        [FromBody] UpdateMemberRoleBodyDto body,
        CancellationToken ct)
    {
        if (!Enum.TryParse<OrgRole>(body.Role, ignoreCase: true, out var role))
            return ToProblem(OrgErrors.InvalidRole);

        var result = await mediator.Send(new UpdateMemberRoleCommand(slug, userId, role), ct);
        return result.IsSuccess ? Ok(result.Value) : ToProblem(result.Error!);
    }

    [HttpDelete("{slug}/members/{userId:guid}")]
    [RequireOrgRole(OrgRole.Admin)]
    public async Task<ActionResult> RemoveMember(string slug, Guid userId, CancellationToken ct)
    {
        var result = await mediator.Send(new RemoveOrgMemberCommand(slug, userId), ct);
        return result.IsSuccess ? NoContent() : ToProblem(result.Error!);
    }

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Org.NotFound" => StatusCodes.Status404NotFound,
            "Org.MemberNotFound" => StatusCodes.Status404NotFound,
            "Org.CannotModifyOwner" => StatusCodes.Status403Forbidden,
            "Org.CannotPromoteToOwner" => StatusCodes.Status403Forbidden,
            "Org.LastOwner" => StatusCodes.Status409Conflict,
            "Org.LogoTooLarge" => StatusCodes.Status413PayloadTooLarge,
            "Org.LogoInvalidType" => StatusCodes.Status415UnsupportedMediaType,
            _ => StatusCodes.Status400BadRequest
        };
        return Problem(title: error.Code, detail: error.Message, statusCode: status);
    }
}

public record CreateOrgFormDto(string Name, IFormFile? Logo);
public record UpdateOrgBodyDto(string Name);
public record SetSsoBodyDto(bool Enabled);
public record UpdateMemberRoleBodyDto(string Role);
