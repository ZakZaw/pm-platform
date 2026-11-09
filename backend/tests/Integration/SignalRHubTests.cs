using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Integration.Infrastructure;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;

namespace Integration;

/// <summary>H1 - hub group joins are authorised like the REST API; a real SignalR client over the TestServer.</summary>
[Collection(ApiCollection.Name)]
public class SignalRHubTests(ApiFixture fx)
{
    private TestApi Api => fx.Api;

    private HubConnection Connect(string accessToken)
    {
        var server = Api.Factory.Server;
        return new HubConnectionBuilder()
            .WithUrl(new Uri(server.BaseAddress, "/hubs/project"), o =>
            {
                o.HttpMessageHandlerFactory = _ => server.CreateHandler();
                o.Transports = HttpTransportType.LongPolling;
                o.AccessTokenProvider = () => Task.FromResult<string?>(accessToken);
            })
            .Build();
    }

    [Fact]
    public async Task Non_member_cannot_join_project_or_channel_groups_and_receives_nothing()
    {
        var w = await SeededWorld.GetAsync(Api);
        var channelId = await Api.WithDbAsync(db =>
            db.Channels.Where(c => c.ProjectId == w.Engineering.Id).Select(c => c.Id).FirstAsync());

        await using var member = Connect(w.OwnerA.AccessToken);
        await using var outsider = Connect(w.OwnerB.AccessToken);

        var memberGot = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var outsiderEvents = 0;
        member.On<JsonElement>("board.changed", e => memberGot.TrySetResult(e));
        outsider.On<JsonElement>("board.changed", _ => Interlocked.Increment(ref outsiderEvents));

        await member.StartAsync();
        await outsider.StartAsync();

        await member.InvokeAsync("JoinProject", w.Engineering.Id.ToString());
        await member.InvokeAsync("JoinChannel", channelId.ToString());

        var projectJoin = await Assert.ThrowsAsync<HubException>(() =>
            outsider.InvokeAsync("JoinProject", w.Engineering.Id.ToString()));
        Assert.Contains("do not have access", projectJoin.Message);
        await Assert.ThrowsAsync<HubException>(() => outsider.InvokeAsync("JoinChannel", channelId.ToString()));
        await Assert.ThrowsAsync<HubException>(() => outsider.InvokeAsync("JoinProject", "not-a-guid"));
        // Non-canonical spellings of the id don't open a side door.
        await Assert.ThrowsAsync<HubException>(() =>
            outsider.InvokeAsync("JoinProject", w.Engineering.Id.ToString("B").ToUpperInvariant()));

        // Generate a project event: a status change publishes board.changed.
        var task = await Api.CreateTaskAsync(w.OwnerA, w.Engineering.Id, "Hub probe");
        var taskId = task.GetProperty("id").GetGuid();
        await TestApi.ExpectAsync(
            await w.OwnerA.Client.PatchAsJsonAsync($"/api/v1/tasks/{taskId}/status", new { to = "InProgress" }),
            HttpStatusCode.OK);

        var evt = await memberGot.Task.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(taskId, evt.GetProperty("taskId").GetGuid());

        await Task.Delay(TimeSpan.FromSeconds(1));
        Assert.Equal(0, Volatile.Read(ref outsiderEvents));
    }

    [Fact]
    public async Task Anonymous_connections_are_refused()
    {
        await using var anon = Connect(accessToken: "");
        await Assert.ThrowsAnyAsync<Exception>(() => anon.StartAsync());
    }
}
