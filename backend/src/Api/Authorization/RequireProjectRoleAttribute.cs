using Application.Authorization;
using Application.Common;
using Domain.Enums;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Api.Authorization;

/// <summary>
/// Requires the caller to hold at least <see cref="Minimum"/> on a project
/// AND to be an active member of that project's org (personal projects:
/// owner only). The project is identified either directly by the
/// <c>{projectId}</c> route value (default), or indirectly: pass a
/// <see cref="ProjectScope"/> and the route/query key holding the entity
/// id, and the filter resolves the entity's owning project first, e.g.
/// <c>[RequireProjectRole(ProjectRole.Viewer, ProjectScope.Task, "id")]</c>
/// on <c>GET /tasks/{id}</c>.
///
/// Responses: 400 when the id is missing/malformed, 401 unauthenticated,
/// 404 when the entity/project doesn't exist, 403 when not a member or the
/// role is too low. All bodies are RFC 7807 problem details.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequireProjectRoleAttribute : Attribute, IAsyncActionFilter
{
    public RequireProjectRoleAttribute(ProjectRole minimum)
        : this(minimum, ProjectScope.Project, "projectId") { }

    public RequireProjectRoleAttribute(ProjectRole minimum, ProjectScope scope, string routeKey)
    {
        Minimum = minimum;
        Scope = scope;
        RouteKey = routeKey;
    }

    public ProjectRole Minimum { get; }
    public ProjectScope Scope { get; }
    public string RouteKey { get; }

    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var raw = AccessFilterHelpers.ReadValue(ctx, RouteKey);
        if (!Guid.TryParse(raw, out var id))
        {
            ctx.Result = AccessFilterHelpers.Problem(
                new Error("Project.MissingId", $"A valid '{RouteKey}' is required."), 400);
            return;
        }

        var access = AccessFilterHelpers.Access(ctx);
        if (access.CurrentPrincipal() is not { } principal)
        {
            ctx.Result = AccessFilterHelpers.Problem(AuthErrors.NotAuthenticated, 401);
            return;
        }

        var ct = ctx.HttpContext.RequestAborted;
        var projectId = Scope == ProjectScope.Project
            ? id
            : await access.ResolveProjectIdAsync(Scope, id, ct);
        if (projectId is null)
        {
            ctx.Result = AccessFilterHelpers.Problem(
                new Error($"{Scope}.NotFound", $"{Scope} not found."), 404);
            return;
        }

        var result = await access.CheckProjectAsync(principal, projectId.Value, Minimum, ct);
        if (!result.IsSuccess)
        {
            ctx.Result = AccessFilterHelpers.FromAccessError(result.Error!);
            return;
        }

        ctx.HttpContext.Items[AccessFilterHelpers.ProjectIdItem] = projectId.Value;
        await next();
    }
}
