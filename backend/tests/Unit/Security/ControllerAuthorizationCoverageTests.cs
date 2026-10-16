using System.Reflection;
using Api.Authorization;
using Application.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;

namespace Unit.Security;

/// <summary>
/// C1 regression guard. Every API action must either carry a project/org
/// role requirement (<see cref="RequireProjectRoleAttribute"/> /
/// <see cref="RequireOrgRoleAttribute"/>, on the action or controller) or
/// appear in the small, justified allow-list below. Adding an endpoint
/// without deciding its authorization fails this test.
/// </summary>
public class ControllerAuthorizationCoverageTests
{
    /// <summary>
    /// "Controller.Action" → why it needs no project/org gate. Keep this
    /// short; every entry is an endpoint that is anonymous by design or
    /// only ever touches the caller's own data.
    /// </summary>
    private static readonly Dictionary<string, string> AllowList = new()
    {
        // Authentication itself (anonymous by design; rate limited).
        ["AuthController.Register"] = "auth: anonymous sign-up",
        ["AuthController.Login"] = "auth: anonymous sign-in",
        ["AuthController.Refresh"] = "auth: refresh-token rotation, token is the credential",

        // Public / token-gated links.
        ["ShareController.GetRoadmap"] = "public share link: token (+ optional password) is the credential",
        ["MeetingsController.JoinAsGuest"] = "guest meeting link: token is the credential",
        ["InvitationsController.Preview"] = "invitation preview: token is the credential",
        ["InvitationsController.Accept"] = "invitation accept: token + caller email must match the invite",

        // Signed inbound callbacks.
        ["WebhooksController.GitHub"] = "webhook: HMAC-signed by GitHub",
        ["VideoWebhookController.Post"] = "webhook: signed by LiveKit",
        ["IntegrationsController.Callback"] = "OAuth callback: data-protected state binds user + project",

        // The caller's own data (/users/me/*, own notifications).
        ["UsersController.Me"] = "/users/me",
        ["UsersController.UpdateMe"] = "/users/me",
        ["UsersController.UploadAvatar"] = "/users/me",
        ["UsersController.DeleteAvatar"] = "/users/me",
        ["UsersController.MyOrgs"] = "/users/me",
        ["UsersController.MyTasks"] = "/users/me",
        ["UsersController.MyOperationsRuns"] = "/users/me",
        ["UsersController.MyHome"] = "/users/me",
        ["UsersController.MyPersonalProject"] = "/users/me",
        ["NotificationsController.GetMine"] = "/users/me: own notifications",
        ["NotificationsController.MarkRead"] = "own notification: handler filters by caller id",
        ["NotificationsController.MarkAllRead"] = "own notifications: handler filters by caller id",

        // Tenant creation / tenant-free.
        ["OrgsController.Create"] = "creates a new org owned by the caller",
        ["AIController.Clarify"] = "stateless AI prompt, reads no tenant data (AI rate-limit policy)",
    };

    private static IEnumerable<(Type Controller, MethodInfo Action)> Actions() =>
        typeof(RequireProjectRoleAttribute).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
            .SelectMany(t => t.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
                .Where(m => m.GetCustomAttributes<HttpMethodAttribute>().Any())
                .Select(m => (t, m)));

    private static string Key(Type c, MethodInfo m) => $"{c.Name}.{m.Name}";

    private static bool HasRoleRequirement(Type c, MethodInfo m) =>
        m.GetCustomAttribute<RequireProjectRoleAttribute>() is not null
        || m.GetCustomAttribute<RequireOrgRoleAttribute>() is not null
        || c.GetCustomAttribute<RequireProjectRoleAttribute>() is not null
        || c.GetCustomAttribute<RequireOrgRoleAttribute>() is not null;

    [Fact]
    public void FindsTheControllers()
    {
        Assert.True(Actions().Count() > 150, "Reflection found suspiciously few actions.");
    }

    [Fact]
    public void EveryAction_HasARoleRequirement_OrIsAllowListed()
    {
        var missing = Actions()
            .Where(a => !HasRoleRequirement(a.Controller, a.Action) && !AllowList.ContainsKey(Key(a.Controller, a.Action)))
            .Select(a => Key(a.Controller, a.Action))
            .OrderBy(k => k)
            .ToList();

        Assert.True(missing.Count == 0,
            "Actions without [RequireProjectRole]/[RequireOrgRole] or an allow-list entry:\n  "
            + string.Join("\n  ", missing));
    }

    [Fact]
    public void AllowList_HasNoStaleOrRedundantEntries()
    {
        var actions = Actions().ToDictionary(a => Key(a.Controller, a.Action), a => a);
        var stale = AllowList.Keys.Where(k => !actions.ContainsKey(k)).ToList();
        var redundant = AllowList.Keys
            .Where(k => actions.TryGetValue(k, out var a) && HasRoleRequirement(a.Controller, a.Action))
            .ToList();

        Assert.True(stale.Count == 0, "Allow-list entries for missing actions: " + string.Join(", ", stale));
        Assert.True(redundant.Count == 0, "Allow-listed actions that already have a role gate: " + string.Join(", ", redundant));
    }

    [Fact]
    public void RoleAttributes_PointAtARealRouteParameter()
    {
        var problems = new List<string>();
        foreach (var (c, m) in Actions())
        {
            var template = string.Join(" ", m.GetCustomAttributes<HttpMethodAttribute>().Select(h => h.Template)
                .Concat(c.GetCustomAttributes<RouteAttribute>().Select(r => r.Template)));

            string? key = m.GetCustomAttribute<RequireProjectRoleAttribute>()?.RouteKey
                ?? m.GetCustomAttribute<RequireOrgRoleAttribute>()?.RouteKey;
            if (key is null) continue;

            var inRoute = template.Contains("{" + key + "}") || template.Contains("{" + key + ":");
            var fromQuery = m.GetParameters().Any(p =>
                p.GetCustomAttribute<FromQueryAttribute>() is { } q && (q.Name ?? p.Name) == key);
            if (!inRoute && !fromQuery)
                problems.Add($"{Key(c, m)} → '{key}' is not in route '{template}' or a [FromQuery] parameter");
        }

        Assert.True(problems.Count == 0, string.Join("\n", problems));
    }

    [Fact]
    public void AnonymousActions_AreAllAllowListed()
    {
        var anonymous = Actions()
            .Where(a => a.Action.GetCustomAttribute<Microsoft.AspNetCore.Authorization.AllowAnonymousAttribute>() is not null
                     || a.Controller.GetCustomAttribute<Microsoft.AspNetCore.Authorization.AllowAnonymousAttribute>() is not null)
            .Select(a => Key(a.Controller, a.Action))
            .Where(k => !AllowList.ContainsKey(k))
            .ToList();

        Assert.True(anonymous.Count == 0, "Anonymous actions not in the allow-list: " + string.Join(", ", anonymous));
    }

    [Fact]
    public void ProjectScopeAttributes_UseAKnownScope()
    {
        foreach (var (c, m) in Actions())
        {
            var attr = m.GetCustomAttribute<RequireProjectRoleAttribute>();
            if (attr is null) continue;
            Assert.True(Enum.IsDefined(attr.Scope), $"{Key(c, m)} uses an undefined ProjectScope");
            if (attr.Scope == ProjectScope.Project)
                Assert.Equal("projectId", attr.RouteKey);
        }
    }
}
