using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Integration.Infrastructure;

/// <summary>
/// One Postgres server and one migrated API database for the whole run.
/// Every test class joins the "Api" collection, so they share this
/// fixture and run one after another (concurrency tests fan out inside a
/// test). Tests isolate themselves by creating their own users and orgs.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public PostgresServer Server { get; private set; } = null!;
    public ApiFactory Factory { get; private set; } = null!;
    public TestApi Api { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        Server = await PostgresServer.StartAsync();
        var cs = await Server.CreateDatabaseAsync("pmp_api");
        Factory = new ApiFactory(cs);

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.MigrateAsync();
        }

        Api = new TestApi(Factory);
    }

    public async Task DisposeAsync()
    {
        await Factory.DisposeAsync();
        await Server.DisposeAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "Api";
}
