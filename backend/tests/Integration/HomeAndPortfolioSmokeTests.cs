using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AISuggestion = Domain.Entities.AISuggestion;
using Integration.Infrastructure;

namespace Integration;

/// <summary>
/// Smoke tests for the read endpoints added in PRs #4 (typed roadmap / AI
/// inbox) and #6 (server-computed home analytics): 200 with sane shapes on
/// seeded and on empty data, never a 500.
/// </summary>
[Collection(ApiCollection.Name)]
public class HomeAndPortfolioSmokeTests(ApiFixture fx)
{
    private TestApi Api => fx.Api;

    private static readonly string[] AllTypes = ["Engineering", "Sales", "Support", "Marketing", "Operations", "Generic"];

    private static async Task<JsonElement> OkObjectAsync(HttpClient client, string url)
    {
        var body = await TestApi.ExpectAsync(await client.GetAsync(url), HttpStatusCode.OK);
        Assert.True(body.ValueKind == JsonValueKind.Object, $"{url}: expected a JSON object, got {body.ValueKind}");
        return body;
    }

    [Fact]
    public async Task Roadmap_timeline_works_for_seeded_engineering_and_sales_projects()
    {
        var w = await SeededWorld.GetAsync(Api);
        await SeedSuggestionAsync(w);

        var eng = await OkObjectAsync(w.OwnerA.Client, $"/api/v1/projects/{w.Engineering.Id}/roadmap/timeline");
        Assert.Contains("Checkout revamp", eng.GetRawText());

        await OkObjectAsync(w.OwnerA.Client, $"/api/v1/projects/{w.Sales.Id}/roadmap/timeline");
        await OkObjectAsync(w.OwnerA.Client, $"/api/v1/projects/{w.Support.Id}/roadmap/timeline");
    }

    [Fact]
    public async Task Every_endpoint_answers_on_an_empty_project_of_every_type()
    {
        var owner = await Api.RegisterAsync();
        var org = await Api.CreateOrgAsync(owner);

        // Empty org first: no projects at all.
        var emptyPortfolio = await OkObjectAsync(owner.Client, $"/api/v1/orgs/{org.Slug}/portfolio");
        Assert.Equal(JsonValueKind.Object, emptyPortfolio.GetProperty("kpis").ValueKind);
        Assert.Equal(0, emptyPortfolio.GetProperty("projects").GetArrayLength());
        await OkObjectAsync(owner.Client, $"/api/v1/orgs/{org.Slug}/ai/suggestions");

        foreach (var type in AllTypes)
        {
            var project = await Api.CreateProjectAsync(owner, org, type);
            await OkObjectAsync(owner.Client, $"/api/v1/projects/{project.Id}/roadmap/timeline");
            await OkObjectAsync(owner.Client, $"/api/v1/projects/{project.Id}/analytics/home");
        }

        var portfolio = await OkObjectAsync(owner.Client, $"/api/v1/orgs/{org.Slug}/portfolio");
        Assert.Equal(JsonValueKind.Object, portfolio.GetProperty("kpis").ValueKind);
        Assert.Equal(AllTypes.Length, portfolio.GetProperty("projects").GetArrayLength());
        await OkObjectAsync(owner.Client, $"/api/v1/orgs/{org.Slug}/ai/suggestions");

        var home = await OkObjectAsync(owner.Client, "/api/v1/users/me/home");
        Assert.Equal(JsonValueKind.Object, home.GetProperty("kpis").ValueKind);
    }

    [Fact]
    public async Task Brand_new_user_home_is_empty_not_an_error()
    {
        var user = await Api.RegisterAsync();
        var home = await OkObjectAsync(user.Client, "/api/v1/users/me/home");
        Assert.Equal(JsonValueKind.Object, home.GetProperty("kpis").ValueKind);
        Assert.Equal(JsonValueKind.Array, home.GetProperty("projects").ValueKind);
        Assert.Equal(JsonValueKind.Object, home.GetProperty("insight").ValueKind);
    }

    [Fact]
    public async Task Seeded_org_home_portfolio_and_inbox_return_data()
    {
        var w = await SeededWorld.GetAsync(Api);
        await SeedSuggestionAsync(w);

        // Some activity: a done task and a started sprint.
        var done = await Api.CreateTaskAsync(w.OwnerA, w.Engineering.Id, "Shipped thing", 5);
        await TestApi.ExpectAsync(await w.OwnerA.Client.PatchAsJsonAsync(
            $"/api/v1/tasks/{done.GetProperty("id").GetGuid()}/status", new { to = "Done" }), HttpStatusCode.OK);

        var portfolio = await OkObjectAsync(w.OwnerA.Client, $"/api/v1/orgs/{w.OrgA.Slug}/portfolio");
        Assert.Equal(JsonValueKind.Object, portfolio.GetProperty("kpis").ValueKind);
        Assert.Equal(JsonValueKind.Object, portfolio.GetProperty("rollup").ValueKind);
        Assert.True(portfolio.GetProperty("projects").GetArrayLength() >= 3);

        foreach (var p in new[] { w.Engineering, w.Sales, w.Support })
            await OkObjectAsync(w.OwnerA.Client, $"/api/v1/projects/{p.Id}/analytics/home");

        var inbox = await OkObjectAsync(w.OwnerA.Client, $"/api/v1/orgs/{w.OrgA.Slug}/ai/suggestions");
        Assert.Contains("Integration smoke suggestion", inbox.GetRawText());

        var home = await OkObjectAsync(w.OwnerA.Client, "/api/v1/users/me/home");
        Assert.True(home.GetProperty("projects").GetArrayLength() >= 1);
    }

    private Task SeedSuggestionAsync(SeededWorld w) => Api.WithDbAsync(async db =>
    {
        if (db.AISuggestions.Any(s => s.ProjectId == w.Engineering.Id)) return;
        db.AISuggestions.Add(new AISuggestion
        {
            ProjectId = w.Engineering.Id,
            Kind = "SprintHealth",
            Title = "Integration smoke suggestion",
            Body = "Scope looks heavy for the remaining days.",
            CreatedByUserId = w.OwnerA.Id,
        });
        await db.SaveChangesAsync();
    });
}
