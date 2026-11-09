using Application.Common;
using Infrastructure.Auth;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Api.Authorization;

/// <summary>
/// H6 - endpoints an org API key must never reach: key management, the
/// key creator's personal surface (/users/me, notifications), and
/// account-level actions (creating orgs, accepting invitations). An API
/// key is an org-scoped service credential, not a stand-in for its
/// creator's whole account.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class DenyApiKeyAttribute : Attribute, IAsyncAuthorizationFilter
{
    public Task OnAuthorizationAsync(AuthorizationFilterContext ctx)
    {
        if (ApiKeyAuthenticationHandler.IsApiKeyPrincipal(ctx.HttpContext.User))
        {
            ctx.Result = AccessFilterHelpers.Problem(
                new Error("ApiKey.NotAllowed", "This endpoint can't be called with an API key. Sign in as a user instead."),
                StatusCodes.Status403Forbidden);
        }
        return Task.CompletedTask;
    }
}