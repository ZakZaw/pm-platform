using Api.Authorization;
using Application.Common;
using Application.Features.Organizations;
using Application.Features.Organizations.Commands;
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

    private ObjectResult ToProblem(Error error)
    {
        var status = error.Code switch
        {
            "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
            "Org.NotFound" => StatusCodes.Status404NotFound,
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
