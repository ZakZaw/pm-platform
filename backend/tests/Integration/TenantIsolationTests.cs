using System.Net;
using System.Net.Http.Json;
using Domain.Enums;
using Integration.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Integration;

/// <summary>
/// C1 / C2 / H2 / H5 / H6 - a user (or API key) from org B must not read or
/// change anything in org A, over the real HTTP pipeline with real JWTs.
/// </summary>
[Collection(ApiCollection.Name)]
public class TenantIsolationTests(ApiFixture fx)
{
    private TestApi Api => fx.Api;

    private static HttpRequestMessage Req(HttpMethod method, string url, object? body = null) =>
        new(method, url) { Content = body is null ? null : JsonContent.Create(body) };

    /// <summary>Requests user B fires at org A's data. Every one must be 403 or 404.</summary>
    private static readonly Dictionary<string, Func<SeededWorld, HttpRequestMessage>> CrossTenantRequests = new()
    {
        ["task GET"] = w => Req(HttpMethod.Get, $"/api/v1/tasks/{w.TaskId}"),
        ["task PATCH"] = w => Req(HttpMethod.Patch, $"/api/v1/tasks/{w.TaskId}", new { title = "pwned by B" }),
        ["task DELETE"] = w => Req(HttpMethod.Delete, $"/api/v1/tasks/{w.TaskId}"),
        ["task status PATCH"] = w => Req(HttpMethod.Patch, $"/api/v1/tasks/{w.TaskId}/status", new { to = "Done" }),
        ["task by key via A's org"] = w => Req(HttpMethod.Get, $"/api/v1/orgs/{w.OrgA.Slug}/tasks/by-key/{w.TaskKey}"),
        ["task by key via B's own org"] = w => Req(HttpMethod.Get, $"/api/v1/orgs/{w.OrgB.Slug}/tasks/by-key/{w.TaskKey}"),
        ["project task list"] = w => Req(HttpMethod.Get, $"/api/v1/projects/{w.Engineering.Id}/tasks"),
        ["project task create"] = w => Req(HttpMethod.Post, $"/api/v1/projects/{w.Engineering.Id}/tasks", new { title = "Injected" }),
        ["deal GET"] = w => Req(HttpMethod.Get, $"/api/v1/deals/{w.DealId}"),
        ["deal PATCH"] = w => Req(HttpMethod.Patch, $"/api/v1/deals/{w.DealId}", new { value = 1m }),
        ["ticket GET"] = w => Req(HttpMethod.Get, $"/api/v1/tickets/{w.TicketId}"),
        ["ticket reply POST"] = w => Req(HttpMethod.Post, $"/api/v1/tickets/{w.TicketId}/replies", new { bodyMd = "hi", isInternal = false }),
        ["sprint start"] = w => Req(HttpMethod.Post, $"/api/v1/sprints/{w.SprintId}/start"),
        ["sprint close"] = w => Req(HttpMethod.Post, $"/api/v1/sprints/{w.SprintId}/close", new { moveCarryoversToBacklog = true }),
        ["B's task into A's sprint"] = w => Req(HttpMethod.Post, $"/api/v1/sprints/{w.SprintId}/tasks/{w.TaskB}"),
        ["epic PATCH"] = w => Req(HttpMethod.Patch, $"/api/v1/epics/{w.EpicId}", new { title = "pwned" }),
        ["A's epic via B's project route (H5)"] = w => Req(HttpMethod.Patch,
            $"/api/v1/projects/{w.ProjectB.Id}/epics/{w.EpicId}/dates", new { startDate = "2026-01-01", endDate = "2026-02-01" }),
        ["A's milestone via B's project route (H5)"] = w => Req(HttpMethod.Delete,
            $"/api/v1/projects/{w.ProjectB.Id}/milestones/{w.MilestoneId}"),
        ["attachment download"] = w => Req(HttpMethod.Get, $"/api/v1/attachments/{w.AttachmentId}/download"),
        ["attachment list"] = w => Req(HttpMethod.Get, $"/api/v1/tasks/{w.TaskId}/attachments"),
        ["status-config GET"] = w => Req(HttpMethod.Get, $"/api/v1/projects/{w.Engineering.Id}/status-config"),
        ["status-config PATCH"] = w => Req(HttpMethod.Patch,
            $"/api/v1/projects/{w.Engineering.Id}/status-config/{w.StatusConfigId}", new { displayName = "pwned" }),
        ["AI generate-project into A's org"] = w => Req(HttpMethod.Post,
            $"/api/v1/orgs/{w.OrgA.Slug}/ai/generate-project", new { description = "x", type = "Engineering" }),
        ["roadmap timeline"] = w => Req(HttpMethod.Get, $"/api/v1/projects/{w.Engineering.Id}/roadmap/timeline"),
        ["analytics home"] = w => Req(HttpMethod.Get, $"/api/v1/projects/{w.Engineering.Id}/analytics/home"),
        ["org portfolio"] = w => Req(HttpMethod.Get, $"/api/v1/orgs/{w.OrgA.Slug}/portfolio"),
        ["org AI suggestions"] = w => Req(HttpMethod.Get, $"/api/v1/orgs/{w.OrgA.Slug}/ai/suggestions"),
        ["org members"] = w => Req(HttpMethod.Get, $"/api/v1/orgs/{w.OrgA.Slug}/members"),
        ["share-link create"] = w => Req(HttpMethod.Post, $"/api/v1/projects/{w.Engineering.Id}/roadmap/share-links", new { }),
    };

    public static IEnumerable<object[]> Cases => CrossTenantRequests.Keys.Select(k => new object[] { k });

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task User_from_another_org_is_refused(string name)
    {
        var w = await SeededWorld.GetAsync(Api);

        var resp = await w.OwnerB.Client.SendAsync(CrossTenantRequests[name](w));
        var body = await resp.Content.ReadAsStringAsync();

        Assert.True(resp.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound,
            $"{name}: expected 403/404, got {(int)resp.StatusCode}: {body}");
        // A problem body proves an authorization/lookup refused it - an
        // unmatched route (typo in the test) is an empty 404.
        Assert.Equal("application/problem+json", resp.Content.Headers.ContentType?.MediaType);
        Assert.DoesNotContain(SeededWorld.InternalReplySecret, body);
        Assert.DoesNotContain("Secret task of A", body);
    }

    [Fact]
    public async Task Cross_tenant_writes_left_org_A_untouched()
    {
        var w = await SeededWorld.GetAsync(Api);
        // Fire every request first (the theory may not have run yet in this process).
        foreach (var make in CrossTenantRequests.Values)
            await w.OwnerB.Client.SendAsync(make(w));

        var task = await Api.GetJsonAsync(w.OwnerA.Client, $"/api/v1/tasks/{w.TaskId}");
        Assert.Equal("Secret task of A", task.GetProperty("title").GetString());
        Assert.Equal("Backlog", task.GetProperty("status").GetString());

        var state = await Api.WithDbAsync(async db => new
        {
            Sprint = await db.Sprints.AsNoTracking().SingleAsync(s => s.Id == w.SprintId),
            Epic = await db.Epics.AsNoTracking().SingleAsync(e => e.Id == w.EpicId),
            MilestoneExists = await db.Milestones.AnyAsync(m => m.Id == w.MilestoneId),
            TaskBSprint = await db.Tasks.Where(t => t.Id == w.TaskB).Select(t => t.SprintId).SingleAsync(),
            Injected = await db.Tasks.AnyAsync(t => t.ProjectId == w.Engineering.Id && t.Title == "Injected"),
            Links = await db.RoadmapShareLinks.CountAsync(l => l.ProjectId == w.Engineering.Id),
            Deal = await db.Deals.AsNoTracking().SingleAsync(d => d.Id == w.DealId),
        });
        Assert.Equal(SprintStatus.Planning, state.Sprint.Status);
        Assert.Equal("Checkout revamp", state.Epic.Title);
        Assert.Null(state.Epic.StartDate);
        Assert.True(state.MilestoneExists);
        Assert.Null(state.TaskBSprint);
        Assert.False(state.Injected);
        Assert.Equal(0, state.Links);
        Assert.Equal(125000m, state.Deal.Value);

        // The owner still sees the internal reply - it exists, B just can't reach it.
        var ticket = await Api.GetJsonAsync(w.OwnerA.Client, $"/api/v1/tickets/{w.TicketId}");
        Assert.Contains(SeededWorld.InternalReplySecret, ticket.GetRawText());
    }

    [Fact]
    public async Task Member_removed_from_the_org_loses_project_access()
    {
        var w = await SeededWorld.GetAsync(Api);
        var member = await Api.RegisterAsync("Departing member");
        await Api.AddOrgMemberAsync(w.OrgA.Id, member.Id, OrgRole.Member);
        await Api.AddProjectMemberAsync(w.Engineering.Id, member.Id, ProjectRole.Contributor);

        await TestApi.ExpectAsync(await member.Client.GetAsync($"/api/v1/tasks/{w.TaskId}"), HttpStatusCode.OK);
        await TestApi.ExpectAsync(await member.Client.GetAsync($"/api/v1/projects/{w.Engineering.Id}/tasks"), HttpStatusCode.OK);

        await TestApi.ExpectAsync(
            await w.OwnerA.Client.DeleteAsync($"/api/v1/orgs/{w.OrgA.Slug}/members/{member.Id}"), HttpStatusCode.NoContent);

        // Same (still unexpired) JWT, no access.
        foreach (var url in new[]
                 {
                     $"/api/v1/tasks/{w.TaskId}",
                     $"/api/v1/projects/{w.Engineering.Id}/tasks",
                     $"/api/v1/orgs/{w.OrgA.Slug}/projects",
                     $"/api/v1/orgs/{w.OrgA.Slug}/tasks/by-key/{w.TaskKey}",
                 })
        {
            var resp = await member.Client.GetAsync(url);
            Assert.True(resp.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound,
                $"{url}: expected 403/404 after removal, got {(int)resp.StatusCode}");
        }

        var stillInProject = await Api.WithDbAsync(db =>
            db.ProjectMemberships.AnyAsync(m => m.UserId == member.Id && m.ProjectId == w.Engineering.Id));
        Assert.False(stillInProject);
    }

    [Fact]
    public async Task Api_key_from_another_org_is_rejected_even_when_its_owner_could_access()
    {
        var w = await SeededWorld.GetAsync(Api);

        // C belongs to both orgs: a contributor in A, and owner of their own org.
        var c = await Api.RegisterAsync("Two-org user");
        await Api.AddOrgMemberAsync(w.OrgA.Id, c.Id, OrgRole.Member);
        await Api.AddProjectMemberAsync(w.Engineering.Id, c.Id, ProjectRole.Contributor);
        var orgC = await Api.CreateOrgAsync(c);
        var created = await Api.PostJsonAsync(c.Client, $"/api/v1/orgs/{orgC.Slug}/api-keys", new { name = "ci key" });
        var secret = created.GetProperty("secret").GetString()!;

        var keyClient = Api.Anonymous();
        keyClient.DefaultRequestHeaders.Add("X-Api-Key", secret);

        // The key works in its own org...
        await TestApi.ExpectAsync(await keyClient.GetAsync($"/api/v1/orgs/{orgC.Slug}/projects"), HttpStatusCode.OK);
        // ...and C's JWT reaches org A...
        await TestApi.ExpectAsync(await c.Client.GetAsync($"/api/v1/tasks/{w.TaskId}"), HttpStatusCode.OK);

        // ...but the org-C key is confined to org C.
        foreach (var req in new Func<HttpRequestMessage>[]
                 {
                     () => Req(HttpMethod.Get, $"/api/v1/tasks/{w.TaskId}"),
                     () => Req(HttpMethod.Get, $"/api/v1/projects/{w.Engineering.Id}/tasks"),
                     () => Req(HttpMethod.Patch, $"/api/v1/tasks/{w.TaskId}", new { title = "via key" }),
                     () => Req(HttpMethod.Get, $"/api/v1/orgs/{w.OrgA.Slug}/projects"),
                     () => Req(HttpMethod.Get, $"/api/v1/orgs/{w.OrgA.Slug}/tasks/by-key/{w.TaskKey}"),
                 })
        {
            var r = req();
            var resp = await keyClient.SendAsync(r);
            Assert.True(resp.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound,
                $"{r.Method} {r.RequestUri}: expected 403/404 for a foreign-org key, got {(int)resp.StatusCode}");
        }

        // A random key is unauthenticated, not a fresh identity.
        var bogus = Api.Anonymous();
        bogus.DefaultRequestHeaders.Add("X-Api-Key", "pmk_" + Guid.NewGuid().ToString("N"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await bogus.GetAsync($"/api/v1/orgs/{orgC.Slug}/projects")).StatusCode);

        // Keys can't manage account-level things (H6).
        Assert.True((await keyClient.GetAsync("/api/v1/users/me")).StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized);
    }
}
