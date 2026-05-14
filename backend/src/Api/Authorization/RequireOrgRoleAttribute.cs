using Application.Interfaces;
using Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace Api.Authorization;

/// <summary>
/// Requires the calling user to have at least the given role on the org
/// identified by the {slug} route value. Returns 401 if unauthenticated,
/// 400 if {slug} is missing, 403 if the user is not a member or their role
/// is below the required minimum.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequireOrgRoleAttribute(OrgRole minimum) : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var slug = ctx.RouteData.Values["slug"]?.ToString();
        if (string.IsNullOrWhiteSpace(slug))
        {
            ctx.Result = new ObjectResult(new ProblemDetails
            {
                Title = "Org.MissingSlug",
                Detail = "Org slug is required in the route.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
            return;
        }

        var services = ctx.HttpContext.RequestServices;
        var currentUser = services.GetRequiredService<ICurrentUser>();
        if (currentUser.UserId is not { } userId)
        {
            ctx.Result = new UnauthorizedResult();
            return;
        }

        var db = services.GetRequiredService<IAppDbContext>();
        var role = await db.OrgMemberships
            .Where(m => m.UserId == userId
                     && m.RemovedAt == null
                     && m.Organization.Slug == slug)
            .Select(m => (OrgRole?)m.Role)
            .FirstOrDefaultAsync(ctx.HttpContext.RequestAborted);

        if (role is null)
        {
            ctx.Result = ForbidProblem("Org.NotAMember", "You do not have access to this organization.");
            return;
        }

        // Enum order: Owner=0, Admin=1, Member=2, Guest=3. Lower int = higher privilege.
        if ((int)role.Value > (int)minimum)
        {
            ctx.Result = ForbidProblem(
                "Org.InsufficientRole",
                $"This action requires the {minimum} role or higher; you are {role.Value}.");
            return;
        }

        await next();
    }

    private static ObjectResult ForbidProblem(string code, string detail) => new(new ProblemDetails
    {
        Title = code,
        Detail = detail,
        Status = StatusCodes.Status403Forbidden
    })
    { StatusCode = StatusCodes.Status403Forbidden };
}
