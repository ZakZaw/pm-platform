using Application.Interfaces;
using Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace Api.Authorization;

/// <summary>
/// Requires the calling user to have at least the given role on the project
/// identified by the {projectId} route value. The project's parent org is
/// not separately checked — org access is implied by project membership.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequireProjectRoleAttribute(ProjectRole minimum) : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var raw = ctx.RouteData.Values["projectId"]?.ToString();
        if (!Guid.TryParse(raw, out var projectId))
        {
            ctx.Result = new ObjectResult(new ProblemDetails
            {
                Title = "Project.MissingId",
                Detail = "Project id is required in the route.",
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
        var role = await db.ProjectMemberships
            .Where(m => m.ProjectId == projectId && m.UserId == userId)
            .Select(m => (ProjectRole?)m.Role)
            .FirstOrDefaultAsync(ctx.HttpContext.RequestAborted);

        if (role is null)
        {
            ctx.Result = ForbidProblem("Project.NotAMember", "You do not have access to this project.");
            return;
        }

        // Enum order: PM=0, TeamLead=1, Contributor=2, Viewer=3. Lower int = higher privilege.
        if ((int)role.Value > (int)minimum)
        {
            ctx.Result = ForbidProblem(
                "Project.InsufficientRole",
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
