using System.Net;
using System.Net.Http.Json;
using Integration.Infrastructure;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Integration;

/// <summary>
/// The atomic paths unit tests can't reach: M8 task-key counter, L9
/// sprint close, M4 share-link lockout - all against real Postgres.
/// </summary>
[Collection(ApiCollection.Name)]
public class ConcurrencyTests(ApiFixture fx)
{
    private TestApi Api => fx.Api;

    // ---------------- M8 ----------------

    [Fact]
    public async Task Concurrent_task_creates_get_unique_contiguous_keys()
    {
        var owner = await Api.RegisterAsync();
        var org = await Api.CreateOrgAsync(owner);
        var project = await Api.CreateProjectAsync(owner, org);

        const int n = 20;
        var responses = await Task.WhenAll(Enumerable.Range(1, n).Select(i =>
            owner.Client.PostAsJsonAsync($"/api/v1/projects/{project.Id}/tasks", new { title = $"Parallel task {i}" })));

        var bodies = new List<System.Text.Json.JsonElement>();
        foreach (var r in responses) bodies.Add(await TestApi.ExpectAsync(r, HttpStatusCode.OK));

        var keyNums = bodies.Select(b => b.GetProperty("keyNum").GetInt32()).OrderBy(k => k).ToList();
        Assert.Equal(Enumerable.Range(1, n), keyNums);
        Assert.Equal(n, bodies.Select(b => b.GetProperty("key").GetString()).Distinct().Count());
        Assert.All(bodies, b => Assert.StartsWith(project.Key + "-", b.GetProperty("key").GetString()));

        var counter = await Api.WithDbAsync(db =>
            db.Projects.Where(p => p.Id == project.Id).Select(p => p.LastTaskKeyNum).SingleAsync());
        Assert.Equal(n, counter);

        // The next create continues the sequence.
        var next = await Api.CreateTaskAsync(owner, project.Id, "After the burst");
        Assert.Equal(n + 1, next.GetProperty("keyNum").GetInt32());
    }

    [Fact]
    public async Task Concurrent_single_and_batch_creates_reserve_disjoint_key_blocks()
    {
        var owner = await Api.RegisterAsync();
        var org = await Api.CreateOrgAsync(owner);
        var project = await Api.CreateProjectAsync(owner, org);

        // Batch path: applying an AI task list reserves a block of keys at once.
        object Batch(int b) => new
        {
            tasks = Enumerable.Range(1, 5).Select(i => new
            {
                title = $"Batch {b} task {i}", description = "d", storyPoints = 1, priority = "Medium",
                acceptanceCriteria = Array.Empty<string>(),
            }).ToArray(),
        };

        var requests = Enumerable.Range(1, 10)
            .Select(i => owner.Client.PostAsJsonAsync($"/api/v1/projects/{project.Id}/tasks", new { title = $"Single {i}" }))
            .Concat(Enumerable.Range(1, 3)
                .Select(b => owner.Client.PostAsJsonAsync($"/api/v1/projects/{project.Id}/ai/apply-tasks", Batch(b))));
        var responses = await Task.WhenAll(requests);
        foreach (var r in responses) await TestApi.ExpectAsync(r, null);

        var keyNums = await Api.WithDbAsync(db =>
            db.Tasks.Where(t => t.ProjectId == project.Id).Select(t => t.KeyNum).OrderBy(k => k).ToListAsync());
        Assert.Equal(Enumerable.Range(1, 25), keyNums);
    }

    // ---------------- L9 ----------------

    [Fact]
    public async Task Concurrent_sprint_closes_succeed_once_and_resolved_tasks_stay_put()
    {
        var owner = await Api.RegisterAsync();
        var org = await Api.CreateOrgAsync(owner);
        var project = await Api.CreateProjectAsync(owner, org);

        var sprint = await Api.PostJsonAsync(owner.Client, $"/api/v1/projects/{project.Id}/sprints", new
        {
            name = "Sprint 1",
            startDate = DateTime.UtcNow.Date,
            endDate = DateTime.UtcNow.Date.AddDays(14),
        });
        var sprintId = sprint.GetProperty("id").GetGuid();

        var done = await Api.CreateTaskAsync(owner, project.Id, "Done task", 3);
        var wontDo = await Api.CreateTaskAsync(owner, project.Id, "Won't do task", 2);
        var inProgress = await Api.CreateTaskAsync(owner, project.Id, "In progress task", 5);
        var backlog = await Api.CreateTaskAsync(owner, project.Id, "Untouched task", 1);
        var ids = new[] { done, wontDo, inProgress, backlog }.Select(t => t.GetProperty("id").GetGuid()).ToArray();
        foreach (var id in ids)
            await TestApi.ExpectAsync(await owner.Client.PostAsync($"/api/v1/sprints/{sprintId}/tasks/{id}", null), HttpStatusCode.NoContent);

        await TestApi.ExpectAsync(await owner.Client.PostAsync($"/api/v1/sprints/{sprintId}/start", null), HttpStatusCode.OK);

        await SetStatusAsync(owner, ids[0], "Done");
        await SetStatusAsync(owner, ids[1], "WontDo", "Out of scope");
        await SetStatusAsync(owner, ids[2], "InProgress");

        var closes = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ =>
            owner.Client.PostAsJsonAsync($"/api/v1/sprints/{sprintId}/close", new { moveCarryoversToBacklog = true })));

        Assert.Equal(1, closes.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.All(closes.Where(r => r.StatusCode != HttpStatusCode.OK),
            r => Assert.Equal(HttpStatusCode.UnprocessableEntity, r.StatusCode));

        var tasks = await Api.WithDbAsync(db =>
            db.Tasks.AsNoTracking().Where(t => ids.Contains(t.Id)).ToDictionaryAsync(t => t.Id));
        Assert.Equal(sprintId, tasks[ids[0]].SprintId);   // Done stays with the sprint
        Assert.Equal(sprintId, tasks[ids[1]].SprintId);   // WontDo is not carried over
        Assert.Equal(DomainTaskStatus.WontDo, tasks[ids[1]].Status);
        Assert.Null(tasks[ids[2]].SprintId);              // unfinished work -> backlog
        Assert.Null(tasks[ids[3]].SprintId);

        var closed = await Api.WithDbAsync(db => db.Sprints.AsNoTracking().SingleAsync(s => s.Id == sprintId));
        Assert.Equal(Domain.Enums.SprintStatus.Closed, closed.Status);
        Assert.Equal(3, closed.FinalVelocity);
        Assert.NotNull(closed.ClosedAt);
    }

    private static async Task SetStatusAsync(TestUser user, Guid taskId, string to, string? reason = null) =>
        await TestApi.ExpectAsync(
            await user.Client.PatchAsJsonAsync($"/api/v1/tasks/{taskId}/status", new { to, reason }),
            HttpStatusCode.OK);

    // ---------------- M4 ----------------

    private async Task<string> CreatePasswordLinkAsync(string password)
    {
        var owner = await Api.RegisterAsync();
        var org = await Api.CreateOrgAsync(owner);
        var project = await Api.CreateProjectAsync(owner, org);
        var link = await Api.PostJsonAsync(owner.Client,
            $"/api/v1/projects/{project.Id}/roadmap/share-links", new { password });
        Assert.True(link.GetProperty("hasPassword").GetBoolean());
        return link.GetProperty("token").GetString()!;
    }

    private Task<HttpResponseMessage> UnlockAsync(string token, string? password) =>
        Api.Anonymous().PostAsJsonAsync($"/api/v1/share/roadmap/{token}", new { password });

    [Fact]
    public async Task Share_link_password_unlocks_and_locks_out_after_repeated_failures()
    {
        const string password = "share-pass-123";
        var token = await CreatePasswordLinkAsync(password);

        await TestApi.ExpectAsync(await UnlockAsync(token, password), HttpStatusCode.OK);
        Assert.Equal(HttpStatusCode.Unauthorized, (await UnlockAsync(token, null)).StatusCode);

        // Header variant of the same gate (the password never goes in the URL).
        var viaHeader = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/share/roadmap/{token}");
        viaHeader.Headers.Add("X-Share-Password", password);
        await TestApi.ExpectAsync(await Api.Anonymous().SendAsync(viaHeader), HttpStatusCode.OK);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await Api.Anonymous().GetAsync($"/api/v1/share/roadmap/{token}?password={password}")).StatusCode);

        for (var i = 0; i < Application.Features.Roadmap.ShareLinkPasswordPolicy.MaxFailures; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await UnlockAsync(token, "wrong-guess-" + i)).StatusCode);

        // Locked: even the right password is refused.
        Assert.Equal(HttpStatusCode.TooManyRequests, (await UnlockAsync(token, password)).StatusCode);

        // Once the lockout window has passed, the right password works again.
        await Api.WithDbAsync(async db =>
        {
            var link = await db.RoadmapShareLinks.SingleAsync(l => l.Token == token);
            Assert.NotNull(link.PasswordLockedUntil);
            link.PasswordLockedUntil = DateTime.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        });
        await TestApi.ExpectAsync(await UnlockAsync(token, password), HttpStatusCode.OK);
        var reset = await Api.WithDbAsync(db => db.RoadmapShareLinks.AsNoTracking().SingleAsync(l => l.Token == token));
        Assert.Equal(0, reset.FailedPasswordAttempts);
        Assert.Null(reset.PasswordLockedUntil);
    }

    [Fact]
    public async Task Share_link_lockout_holds_under_parallel_guessing()
    {
        const string password = "share-pass-456";
        var token = await CreatePasswordLinkAsync(password);
        var threshold = Application.Features.Roadmap.ShareLinkPasswordPolicy.MaxFailures;

        var guesses = await Task.WhenAll(Enumerable.Range(0, threshold).Select(i => UnlockAsync(token, "parallel-guess-" + i)));
        Assert.All(guesses, r => Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode));

        // `threshold` wrong guesses happened, so the link must now be locked.
        Assert.Equal(HttpStatusCode.TooManyRequests, (await UnlockAsync(token, password)).StatusCode);
    }
}
