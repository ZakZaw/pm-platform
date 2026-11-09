using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using OrgMembership = Domain.Entities.OrgMembership;
using ProjectMembership = Domain.Entities.ProjectMembership;
using Domain.Enums;
using Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace Integration.Infrastructure;

/// <summary>A registered user with an HttpClient that carries their access token.</summary>
public sealed record TestUser(Guid Id, string Email, string Password, string AccessToken, string RefreshToken, HttpClient Client);

public sealed record TestOrg(Guid Id, string Slug);

public sealed record TestProject(Guid Id, string Key, string Slug);

/// <summary>Thin helpers over the real HTTP API (plus direct DB seeding where the API flow is incidental).</summary>
public sealed class TestApi(ApiFactory factory)
{
    public const string Password = "Correct-Horse-9-Battery";

    public ApiFactory Factory => factory;

    public HttpClient Anonymous() => factory.CreateClient();

    public HttpClient ClientWithToken(string accessToken)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return client;
    }

    public async Task<TestUser> RegisterAsync(string name = "Test User")
    {
        var email = $"u{Guid.NewGuid():N}@example.test";
        var resp = await Anonymous().PostAsJsonAsync("/api/v1/auth/register",
            new { email, password = Password, fullName = name });
        var body = await ExpectAsync(resp, HttpStatusCode.OK);
        var access = body.GetProperty("accessToken").GetString()!;
        return new TestUser(
            body.GetProperty("userId").GetGuid(), email, Password,
            access, body.GetProperty("refreshToken").GetString()!,
            ClientWithToken(access));
    }

    public async Task<TestOrg> CreateOrgAsync(TestUser owner, string? name = null)
    {
        using var form = new MultipartFormDataContent
        {
            { new StringContent(name ?? "Org " + Guid.NewGuid().ToString("N")[..8]), "Name" },
        };
        var body = await ExpectAsync(await owner.Client.PostAsync("/api/v1/orgs", form), HttpStatusCode.Created);
        return new TestOrg(body.GetProperty("id").GetGuid(), body.GetProperty("slug").GetString()!);
    }

    public async Task<TestProject> CreateProjectAsync(TestUser user, TestOrg org, string type = "Engineering", string? name = null)
    {
        var resp = await user.Client.PostAsJsonAsync($"/api/v1/orgs/{org.Slug}/projects",
            new { name = name ?? $"{type} {Guid.NewGuid():N}"[..20], type, aiControlMode = "Off" });
        var body = await ExpectAsync(resp, HttpStatusCode.Created);
        return new TestProject(body.GetProperty("id").GetGuid(), body.GetProperty("key").GetString()!,
            body.GetProperty("slug").GetString()!);
    }

    public async Task<JsonElement> CreateTaskAsync(TestUser user, Guid projectId, string title = "A task", int? storyPoints = null)
    {
        var resp = await user.Client.PostAsJsonAsync($"/api/v1/projects/{projectId}/tasks",
            new { title, storyPoints });
        return await ExpectAsync(resp, HttpStatusCode.OK);
    }

    /// <summary>POST that must succeed (any 2xx unless a specific status is given).</summary>
    public async Task<JsonElement> PostJsonAsync(HttpClient client, string url, object body, HttpStatusCode? expected = null) =>
        await ExpectAsync(await client.PostAsJsonAsync(url, body), expected);

    public async Task<JsonElement> GetJsonAsync(HttpClient client, string url) =>
        await ExpectAsync(await client.GetAsync(url), HttpStatusCode.OK);

    // ---- direct seeding (membership plumbing the tests don't exercise) ----

    public Task AddOrgMemberAsync(Guid orgId, Guid userId, OrgRole role) => WithDbAsync(async db =>
    {
        db.OrgMemberships.Add(new OrgMembership { OrganizationId = orgId, UserId = userId, Role = role });
        await db.SaveChangesAsync();
    });

    public Task AddProjectMemberAsync(Guid projectId, Guid userId, ProjectRole role) => WithDbAsync(async db =>
    {
        db.ProjectMemberships.Add(new ProjectMembership { ProjectId = projectId, UserId = userId, Role = role });
        await db.SaveChangesAsync();
    });

    public async Task WithDbAsync(Func<AppDbContext, Task> action)
    {
        using var scope = factory.Services.CreateScope();
        await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    public async Task<T> WithDbAsync<T>(Func<AppDbContext, Task<T>> action)
    {
        using var scope = factory.Services.CreateScope();
        return await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    /// <summary>Asserts the status (any 2xx when <paramref name="expected"/> is null) and parses the JSON body.</summary>
    public static async Task<JsonElement> ExpectAsync(HttpResponseMessage resp, HttpStatusCode? expected)
    {
        var text = await resp.Content.ReadAsStringAsync();
        var ok = expected is { } e ? resp.StatusCode == e : resp.IsSuccessStatusCode;
        Assert.True(ok,
            $"{resp.RequestMessage?.Method} {resp.RequestMessage?.RequestUri} returned {(int)resp.StatusCode}, " +
            $"expected {(expected is { } x ? ((int)x).ToString() : "2xx")}: {text}");
        return string.IsNullOrWhiteSpace(text) ? default : JsonDocument.Parse(text).RootElement.Clone();
    }
}
