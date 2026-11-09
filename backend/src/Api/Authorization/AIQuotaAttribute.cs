using Application.Common;
using Application.Interfaces;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace Api.Authorization;

/// <summary>
/// H4 - marks an endpoint that calls the AI provider (pair it with
/// <c>[EnableRateLimiting("ai")]</c> for burst control) and charges one call to
/// the daily quota of the org the request was authorised against (set by
/// the role filters, which run first), falling back to the caller for
/// org-less calls. Over quota: 429 problem details.
/// </summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
public sealed class AIQuotaAttribute : Attribute, IAsyncActionFilter, IOrderedFilter
{
    /// <summary>Rate-limit policy paired with this attribute: <c>[EnableRateLimiting(AIQuotaAttribute.PolicyName)]</c>.</summary>
    public const string PolicyName = "ai";

    /// <summary>After the role filters (Order 0), so the org is known and denied calls aren't charged.</summary>
    public int Order => 100;

    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var http = ctx.HttpContext;
        var services = http.RequestServices;
        var partition = await ResolvePartitionAsync(http, services);

        var quota = services.GetRequiredService<IAIUsageQuota>();
        if (!quota.TryConsume(partition, DateTime.UtcNow))
        {
            ctx.Result = AccessFilterHelpers.Problem(
                new Error("AI.QuotaExceeded", "The daily AI usage limit has been reached. It resets at 00:00 UTC."),
                StatusCodes.Status429TooManyRequests);
            return;
        }

        await next();
    }

    private static async Task<string> ResolvePartitionAsync(HttpContext http, IServiceProvider services)
    {
        if (http.Items[AccessFilterHelpers.OrgIdItem] is Guid orgId)
            return "org:" + orgId.ToString("D");

        if (http.Items[AccessFilterHelpers.ProjectIdItem] is Guid projectId)
        {
            var db = services.GetRequiredService<IAppDbContext>();
            var projectOrg = await db.Projects
                .Where(p => p.Id == projectId)
                .Select(p => p.OrganizationId)
                .FirstOrDefaultAsync(http.RequestAborted);
            if (projectOrg is { } id)
                return "org:" + id.ToString("D");
        }

        var userId = services.GetRequiredService<ICurrentUser>().UserId;
        return "user:" + (userId?.ToString("D") ?? "anonymous");
    }
}