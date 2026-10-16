using Application.Authorization;
using Application.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Api.Authorization;

internal static class AccessFilterHelpers
{
    public static IAccessControl Access(ActionExecutingContext ctx) =>
        ctx.HttpContext.RequestServices.GetRequiredService<IAccessControl>();

    /// <summary>Route value first, then query string.</summary>
    public static string? ReadValue(ActionExecutingContext ctx, string key)
    {
        var fromRoute = ctx.RouteData.Values[key]?.ToString();
        if (!string.IsNullOrWhiteSpace(fromRoute)) return fromRoute;
        var fromQuery = ctx.HttpContext.Request.Query[key].ToString();
        return string.IsNullOrWhiteSpace(fromQuery) ? null : fromQuery;
    }

    public static ObjectResult FromAccessError(Error error) => Problem(error, error.Code switch
    {
        "Auth.NotAuthenticated" => StatusCodes.Status401Unauthorized,
        "Project.NotFound" or "Org.NotFound" => StatusCodes.Status404NotFound,
        _ => StatusCodes.Status403Forbidden,
    });

    public static ObjectResult Problem(Error error, int status) => new(new ProblemDetails
    {
        Title = error.Code,
        Detail = error.Message,
        Status = status,
    })
    {
        StatusCode = status,
        ContentTypes = { "application/problem+json" },
    };
}
