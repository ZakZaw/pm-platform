using System.Net;
using System.Net.Http.Json;
using Integration.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Integration;

/// <summary>M1 validation pipeline, M3 refresh-token families, M5 logout - over real HTTP.</summary>
[Collection(ApiCollection.Name)]
public class AuthTests(ApiFixture fx)
{
    private TestApi Api => fx.Api;

    private async Task<(string Access, string Refresh)> LoginAsync(TestUser user)
    {
        var body = await Api.PostJsonAsync(Api.Anonymous(), "/api/v1/auth/login",
            new { email = user.Email, password = user.Password });
        return (body.GetProperty("accessToken").GetString()!, body.GetProperty("refreshToken").GetString()!);
    }

    private Task<HttpResponseMessage> RefreshAsync(string refreshToken) =>
        Api.Anonymous().PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken });

    [Fact]
    public async Task Login_and_refresh_issue_working_tokens()
    {
        var user = await Api.RegisterAsync();
        var (access, refresh) = await LoginAsync(user);

        await TestApi.ExpectAsync(await Api.ClientWithToken(access).GetAsync("/api/v1/users/me"), HttpStatusCode.OK);

        var rotated = await TestApi.ExpectAsync(await RefreshAsync(refresh), HttpStatusCode.OK);
        var newAccess = rotated.GetProperty("accessToken").GetString()!;
        Assert.NotEqual(refresh, rotated.GetProperty("refreshToken").GetString());
        var me = await TestApi.ExpectAsync(await Api.ClientWithToken(newAccess).GetAsync("/api/v1/users/me"), HttpStatusCode.OK);
        Assert.Equal(user.Email, me.GetProperty("email").GetString());
    }

    [Fact]
    public async Task Wrong_password_is_rejected()
    {
        var user = await Api.RegisterAsync();
        var resp = await Api.Anonymous().PostAsJsonAsync("/api/v1/auth/login",
            new { email = user.Email, password = "not-the-password" });
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Reusing_a_rotated_refresh_token_revokes_the_whole_family()
    {
        var user = await Api.RegisterAsync();
        var (_, r1) = await LoginAsync(user);

        var second = await TestApi.ExpectAsync(await RefreshAsync(r1), HttpStatusCode.OK);
        var r2 = second.GetProperty("refreshToken").GetString()!;
        var third = await TestApi.ExpectAsync(await RefreshAsync(r2), HttpStatusCode.OK);
        var r3 = third.GetProperty("refreshToken").GetString()!;

        // r1 was already rotated: replaying it is reuse.
        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshAsync(r1)).StatusCode);
        // ...so the newest token in the chain is dead too.
        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshAsync(r3)).StatusCode);

        // Other sessions (a separate login = separate family) are untouched.
        var (_, other) = await LoginAsync(user);
        await TestApi.ExpectAsync(await RefreshAsync(other), HttpStatusCode.OK);
    }

    [Theory]
    [InlineData(2)]
    [InlineData(10)]
    public async Task Parallel_refreshes_with_the_same_token_mint_exactly_one_successor(int parallel)
    {
        var user = await Api.RegisterAsync();
        var (_, refresh) = await LoginAsync(user);

        var responses = await Task.WhenAll(Enumerable.Range(0, parallel).Select(_ => RefreshAsync(refresh)));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.All(responses.Where(r => r.StatusCode != HttpStatusCode.OK),
            r => Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode));

        // No fork: exactly one successor token was minted for this user
        // (a successor is any token that didn't start its own family).
        var successors = await Api.WithDbAsync(db =>
            db.RefreshTokens.CountAsync(t => t.UserId == user.Id && t.FamilyId != t.Id));
        Assert.Equal(1, successors);
    }

    [Fact]
    public async Task Replay_racing_a_legitimate_refresh_still_kills_the_family()
    {
        // A thief replays an already-rotated token at the same moment the
        // legitimate client rotates the current one. Reuse is detected
        // every time, so whatever the interleaving, no token of the family
        // may survive.
        var user = await Api.RegisterAsync();
        for (var i = 0; i < 25; i++)
        {
            var (_, r1) = await LoginAsync(user);
            var r2 = (await TestApi.ExpectAsync(await RefreshAsync(r1), HttpStatusCode.OK))
                .GetProperty("refreshToken").GetString()!;

            var results = await Task.WhenAll(RefreshAsync(r2), RefreshAsync(r1));
            Assert.Equal(HttpStatusCode.Unauthorized, results[1].StatusCode);

            if (results[0].StatusCode == HttpStatusCode.OK)
            {
                var r3 = (await TestApi.ExpectAsync(results[0], HttpStatusCode.OK)).GetProperty("refreshToken").GetString()!;
                Assert.True((await RefreshAsync(r3)).StatusCode == HttpStatusCode.Unauthorized,
                    $"iteration {i}: the successor minted while reuse was being handled escaped the family revocation");
            }
        }
    }

    [Fact]
    public async Task Logout_revokes_the_refresh_token()
    {
        var user = await Api.RegisterAsync();
        var (_, refresh) = await LoginAsync(user);

        var resp = await Api.Anonymous().PostAsJsonAsync("/api/v1/auth/logout", new { refreshToken = refresh });
        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshAsync(refresh)).StatusCode);

        // Unknown tokens are a silent no-op (no token probing).
        var unknown = await Api.Anonymous().PostAsJsonAsync("/api/v1/auth/logout", new { refreshToken = "nope" });
        Assert.Equal(HttpStatusCode.NoContent, unknown.StatusCode);
    }

    [Fact]
    public async Task Logout_all_revokes_every_session_of_the_caller()
    {
        var user = await Api.RegisterAsync();
        var (access1, refresh1) = await LoginAsync(user);
        var (_, refresh2) = await LoginAsync(user);
        var other = await Api.RegisterAsync();
        var (_, otherRefresh) = await LoginAsync(other);

        var resp = await Api.ClientWithToken(access1).PostAsync("/api/v1/auth/logout-all", null);
        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshAsync(refresh1)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshAsync(refresh2)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshAsync(user.RefreshToken)).StatusCode);
        // Someone else's session is unaffected.
        await TestApi.ExpectAsync(await RefreshAsync(otherRefresh), HttpStatusCode.OK);
    }

    [Fact]
    public async Task Register_with_a_one_character_password_is_a_400_problem()
    {
        var resp = await Api.Anonymous().PostAsJsonAsync("/api/v1/auth/register",
            new { email = $"v{Guid.NewGuid():N}@example.test", password = "x", fullName = "Short Pw" });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Equal("application/problem+json", resp.Content.Headers.ContentType?.MediaType);
        var body = await resp.Content.ReadAsStringAsync();
        Assert.Contains("Password", body, StringComparison.OrdinalIgnoreCase);
    }
}
