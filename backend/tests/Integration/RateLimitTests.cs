using System.Net;
using System.Net.Http.Json;
using Integration.Infrastructure;

namespace Integration;

/// <summary>
/// H4 - rate limits partition by *verified* identity. Runs a second API
/// host on the same database with deliberately tiny limits.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class RateLimitTests(ApiFixture fx) : IDisposable
{
    private const int GlobalLimit = 5;
    private const int AuthLimit = 3;

    private readonly ApiFactory _limited = new(fx.Factory.ConnectionString, new Dictionary<string, string?>
    {
        ["RateLimit:PermitLimit"] = GlobalLimit.ToString(),
        ["RateLimit:WindowSeconds"] = "3600",
        ["RateLimit:Auth:PermitLimit"] = AuthLimit.ToString(),
        ["RateLimit:Auth:WindowSeconds"] = "3600",
        ["RateLimit:PublicLink:PermitLimit"] = "100000",
        ["RateLimit:AI:PermitLimit"] = "100000",
    });

    public void Dispose() => _limited.Dispose();

    private static string FreshIp() => $"10.{Random.Shared.Next(1, 255)}.{Random.Shared.Next(1, 255)}.{Random.Shared.Next(1, 255)}";

    private HttpClient ClientFrom(string ip)
    {
        var client = _limited.CreateClient();
        client.DefaultRequestHeaders.Add(ApiFactory.ClientIpHeader, ip);
        return client;
    }

    [Fact]
    public async Task Made_up_api_keys_share_the_caller_ip_bucket()
    {
        var ip = FreshIp();
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < GlobalLimit + 3; i++)
        {
            var req = new HttpRequestMessage(HttpMethod.Get, "/api/v1/orgs/whatever/projects");
            req.Headers.Add("X-Api-Key", "pmk_" + Guid.NewGuid().ToString("N"));   // a new key every time
            statuses.Add((await ClientFrom(ip).SendAsync(req)).StatusCode);
        }

        Assert.All(statuses.Take(GlobalLimit), s => Assert.Equal(HttpStatusCode.Unauthorized, s));
        Assert.All(statuses.Skip(GlobalLimit), s => Assert.Equal(HttpStatusCode.TooManyRequests, s));

        // Another IP is unaffected.
        var other = await ClientFrom(FreshIp()).GetAsync("/api/v1/orgs/whatever/projects");
        Assert.Equal(HttpStatusCode.Unauthorized, other.StatusCode);
    }

    [Fact]
    public async Task Verified_identities_get_their_own_bucket()
    {
        var ip = FreshIp();
        // Exhaust the IP's anonymous budget.
        for (var i = 0; i < GlobalLimit; i++)
            await ClientFrom(ip).GetAsync("/api/v1/users/me");
        Assert.Equal(HttpStatusCode.TooManyRequests, (await ClientFrom(ip).GetAsync("/api/v1/users/me")).StatusCode);

        // A signed-in user behind the same IP is counted separately...
        var user = await fx.Api.RegisterAsync();
        var authed = ClientFrom(ip);
        authed.DefaultRequestHeaders.Authorization = new("Bearer", user.AccessToken);
        var first = await authed.GetAsync("/api/v1/users/me");
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(GlobalLimit.ToString(), first.Headers.GetValues("X-RateLimit-Limit").Single());
        Assert.Equal((GlobalLimit - 1).ToString(), first.Headers.GetValues("X-RateLimit-Remaining").Single());

        // ...and has a budget of its own, from any IP.
        for (var i = 1; i < GlobalLimit; i++)
        {
            var hop = ClientFrom(FreshIp());
            hop.DefaultRequestHeaders.Authorization = new("Bearer", user.AccessToken);
            Assert.Equal(HttpStatusCode.OK, (await hop.GetAsync("/api/v1/users/me")).StatusCode);
        }
        var over = await authed.GetAsync("/api/v1/users/me");
        Assert.Equal(HttpStatusCode.TooManyRequests, over.StatusCode);
        Assert.True(over.Headers.Contains("Retry-After"));
    }

    [Fact]
    public async Task Auth_endpoints_have_a_stricter_per_ip_limit()
    {
        var ip = FreshIp();
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < AuthLimit + 1; i++)
        {
            var resp = await ClientFrom(ip).PostAsJsonAsync("/api/v1/auth/login",
                new { email = $"nobody{i}@example.test", password = "whatever-123" });
            statuses.Add(resp.StatusCode);
        }

        Assert.All(statuses.Take(AuthLimit), s => Assert.Equal(HttpStatusCode.Unauthorized, s));
        Assert.Equal(HttpStatusCode.TooManyRequests, statuses[AuthLimit]);
    }
}
