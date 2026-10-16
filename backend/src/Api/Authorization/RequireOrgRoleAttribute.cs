using Application.Authorization;
using Application.Common;
using Domain.Enums;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Api.Authorization;

/// <summary>
/// Requires the caller to have at least <see cref="Minimum"/> as an active
/// member of an org. By default the org is the <c>{slug}</c> route value;
/// pass an <see cref="OrgScope"/> plus the route/query key holding an
/// entity id to resolve the org from that entity instead (e.g. a channel
/// or API key). API-key principals are confined to their key's org.
/// Returns 400 / 401 / 404 / 403 problem details like
/// <see cref="RequireProjectRoleAttribute"/>.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequireOrgRoleAttribute : Attribute, IAsyncActionFilter
{
    public RequireOrgRoleAttribute(OrgRole minimum)
        : this(minimum, OrgScope.Slug, "slug") { }

    public RequireOrgRoleAttribute(OrgRole minimum, OrgScope scope, string routeKey)
    {
        Minimum = minimum;
        Scope = scope;
        RouteKey = routeKey;
    }

    public OrgRole Minimum { get; }
    public OrgScope Scope { get; }
    public string RouteKey { get; }

    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var raw = AccessFilterHelpers.ReadValue(ctx, RouteKey);
        if (string.IsNullOrWhiteSpace(raw))
        {
            ctx.Result = AccessFilterHelpers.Problem(
                new Error("Org.MissingId", $"'{RouteKey}' is required."), 400);
            return;
        }

        var access = AccessFilterHelpers.Access(ctx);
        if (access.CurrentPrincipal() is not { } principal)
        {
            ctx.Result = AccessFilterHelpers.Problem(AuthErrors.NotAuthenticated, 401);
            return;
        }

        var ct = ctx.HttpContext.RequestAborted;
        var orgId = await access.ResolveOrgIdAsync(Scope, raw, ct);
        if (orgId is null)
        {
            var error = Scope is OrgScope.Slug or OrgScope.Organization
                ? OrgErrors.NotFound
                : new Error($"{Scope}.NotFound", $"{Scope} not found.");
            ctx.Result = AccessFilterHelpers.Problem(error, 404);
            return;
        }

        var result = await access.CheckOrgAsync(principal, orgId.Value, Minimum, ct);
        if (!result.IsSuccess)
        {
            ctx.Result = AccessFilterHelpers.FromAccessError(result.Error!);
            return;
        }

        ctx.HttpContext.Items[AccessFilterHelpers.OrgIdItem] = orgId.Value;
        await next();
    }
}
