using System.Security.Claims;
using Application.Interfaces;
using Infrastructure.Auth;
using Microsoft.AspNetCore.Http;

namespace Infrastructure.Services;

public class CurrentUserService(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid? UserId
    {
        get
        {
            var user = accessor.HttpContext?.User;
            if (user is null) return null;

            // An API-key identity wins over a JWT on the same request so the
            // user id and the org confinement always come from one principal.
            var identity = user.Identities.FirstOrDefault(i =>
                    i.IsAuthenticated && i.AuthenticationType == ApiKeyAuthenticationHandler.SchemeName)
                ?? user.Identities.FirstOrDefault(i => i.IsAuthenticated);
            var sub = identity?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? identity?.FindFirst("sub")?.Value;
            return Guid.TryParse(sub, out var id) ? id : null;
        }
    }

    public bool IsAuthenticated => UserId is not null;

    public Guid? ApiKeyOrgId => ApiKeyAuthenticationHandler.GetApiKeyOrgId(accessor.HttpContext?.User);
}
