using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Integration.Infrastructure;

/// <summary>
/// Org A with one project of each interesting type and an entity of every
/// kind the isolation tests probe, built through the real API. Org B is a
/// separate tenant whose owner is the "attacker". Built once per run.
/// </summary>
public sealed class SeededWorld
{
    public const string InternalReplySecret = "INTERNAL-ONLY-7f3a9c";

    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static SeededWorld? _instance;

    public required TestUser OwnerA { get; init; }
    public required TestOrg OrgA { get; init; }
    public required TestProject Engineering { get; init; }
    public required TestProject Sales { get; init; }
    public required TestProject Support { get; init; }
    public required Guid TaskId { get; init; }
    public required string TaskKey { get; init; }
    public required Guid EpicId { get; init; }
    public required Guid SprintId { get; init; }
    public required Guid MilestoneId { get; init; }
    public required Guid AttachmentId { get; init; }
    public required Guid StatusConfigId { get; init; }
    public required Guid DealId { get; init; }
    public required Guid TicketId { get; init; }

    public required TestUser OwnerB { get; init; }
    public required TestOrg OrgB { get; init; }
    public required TestProject ProjectB { get; init; }
    public required Guid TaskB { get; init; }

    public static async Task<SeededWorld> GetAsync(TestApi api)
    {
        await Gate.WaitAsync();
        try { return _instance ??= await BuildAsync(api); }
        finally { Gate.Release(); }
    }

    private static async Task<SeededWorld> BuildAsync(TestApi api)
    {
        var a = await api.RegisterAsync("Owner A");
        var orgA = await api.CreateOrgAsync(a, "Tenant A " + Guid.NewGuid().ToString("N")[..6]);
        var eng = await api.CreateProjectAsync(a, orgA, "Engineering", "Apollo Platform");
        var sales = await api.CreateProjectAsync(a, orgA, "Sales", "Enterprise Pipeline");
        var support = await api.CreateProjectAsync(a, orgA, "Support", "Customer Desk");

        var epic = await api.PostJsonAsync(a.Client, $"/api/v1/projects/{eng.Id}/epics", new { title = "Checkout revamp" });
        var epicId = epic.GetProperty("id").GetGuid();
        var task = await api.PostJsonAsync(a.Client, $"/api/v1/projects/{eng.Id}/tasks",
            new { title = "Secret task of A", storyPoints = 3, epicId });
        var taskId = task.GetProperty("id").GetGuid();
        await api.CreateTaskAsync(a, eng.Id, "Second task", 2);

        var sprint = await api.PostJsonAsync(a.Client, $"/api/v1/projects/{eng.Id}/sprints", new
        {
            name = "A sprint",
            startDate = DateTime.UtcNow.Date,
            endDate = DateTime.UtcNow.Date.AddDays(14),
        });
        var sprintId = sprint.GetProperty("id").GetGuid();
        await TestApi.ExpectAsync(await a.Client.PostAsync($"/api/v1/sprints/{sprintId}/tasks/{taskId}", null), HttpStatusCode.NoContent);

        var milestone = await api.PostJsonAsync(a.Client, $"/api/v1/projects/{eng.Id}/milestones",
            new { title = "Beta", date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)) });

        var attachment = await UploadAsync(a.Client, taskId, "diagram.png", "image/png", Png);

        var configs = await api.GetJsonAsync(a.Client, $"/api/v1/projects/{eng.Id}/status-config");
        var configId = configs.GetArrayLength() > 0
            ? configs[0].GetProperty("id").GetGuid()
            : (await api.PostJsonAsync(a.Client, $"/api/v1/projects/{eng.Id}/status-config",
                new { baseStatus = "InProgress", displayName = "Doing" })).GetProperty("id").GetGuid();

        var account = await api.PostJsonAsync(a.Client, $"/api/v1/projects/{sales.Id}/accounts", new { name = "Globex" });
        var deal = await api.PostJsonAsync(a.Client, $"/api/v1/projects/{sales.Id}/deals", new
        {
            accountId = account.GetProperty("id").GetGuid(),
            name = "Globex renewal",
            value = 125000m,
            currency = "USD",
        });

        var customer = await api.PostJsonAsync(a.Client, $"/api/v1/projects/{support.Id}/customers",
            new { name = "Jane Customer", email = "jane@customer.test" });
        var ticket = await api.PostJsonAsync(a.Client, $"/api/v1/projects/{support.Id}/tickets", new
        {
            customerId = customer.GetProperty("id").GetGuid(),
            subject = "Cannot log in",
            bodyMd = "Help",
            priority = "High",
        });
        var ticketId = ticket.GetProperty("id").GetGuid();
        await api.PostJsonAsync(a.Client, $"/api/v1/tickets/{ticketId}/replies",
            new { bodyMd = InternalReplySecret, isInternal = true });

        var b = await api.RegisterAsync("Owner B");
        var orgB = await api.CreateOrgAsync(b, "Tenant B " + Guid.NewGuid().ToString("N")[..6]);
        var projectB = await api.CreateProjectAsync(b, orgB, "Engineering", "Bravo Platform");
        var taskB = await api.CreateTaskAsync(b, projectB.Id, "B's own task");

        return new SeededWorld
        {
            OwnerA = a, OrgA = orgA, Engineering = eng, Sales = sales, Support = support,
            TaskId = taskId, TaskKey = task.GetProperty("key").GetString()!,
            EpicId = epicId, SprintId = sprintId,
            MilestoneId = milestone.GetProperty("id").GetGuid(),
            AttachmentId = attachment.GetProperty("id").GetGuid(),
            StatusConfigId = configId,
            DealId = deal.GetProperty("id").GetGuid(),
            TicketId = ticketId,
            OwnerB = b, OrgB = orgB, ProjectB = projectB, TaskB = taskB.GetProperty("id").GetGuid(),
        };
    }

    /// <summary>A valid 1x1 PNG.</summary>
    public static readonly byte[] Png = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");

    public static Task<HttpResponseMessage> UploadRawAsync(HttpClient client, Guid taskId, string fileName, string contentType, byte[] bytes)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(file, "file", fileName);
        return client.PostAsync($"/api/v1/tasks/{taskId}/attachments", form);
    }

    public static async Task<JsonElement> UploadAsync(HttpClient client, Guid taskId, string fileName, string contentType, byte[] bytes) =>
        await TestApi.ExpectAsync(await UploadRawAsync(client, taskId, fileName, contentType, bytes), HttpStatusCode.OK);
}
