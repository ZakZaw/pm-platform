using System.Diagnostics;
using Npgsql;

namespace Integration.Infrastructure;

/// <summary>
/// The Postgres 16 server the integration tests run against.
///
/// Set <c>PMP_TEST_DB</c> to a connection string for a throwaway server
/// (the database named in it is only used to issue CREATE DATABASE). When
/// it is unset, a single <c>postgres:16-alpine</c> container is started
/// through the Docker CLI for the whole test run (512 MB memory cap) and
/// removed afterwards. Never point PMP_TEST_DB at a database you care
/// about: every test database is created and dropped by the suite.
/// </summary>
public sealed class PostgresServer : IAsyncDisposable
{
    public const string EnvVar = "PMP_TEST_DB";

    private readonly string? _containerName;
    private readonly List<string> _databases = [];

    private PostgresServer(string adminConnectionString, string? containerName)
    {
        AdminConnectionString = adminConnectionString;
        _containerName = containerName;
    }

    public string AdminConnectionString { get; }

    public static async Task<PostgresServer> StartAsync()
    {
        var configured = Environment.GetEnvironmentVariable(EnvVar);
        if (!string.IsNullOrWhiteSpace(configured))
            return new PostgresServer(configured, containerName: null);

        var name = "pmp-itest-" + Guid.NewGuid().ToString("N")[..8];
        await DockerAsync(
            $"run -d --rm --name {name} --memory 512m -e POSTGRES_USER=itest -e POSTGRES_PASSWORD=itest " +
            "-p 127.0.0.1::5432 postgres:16-alpine -c max_connections=200");
        try
        {
            var portLine = (await DockerAsync($"port {name} 5432")).Split('\n')[0].Trim();
            var port = int.Parse(portLine[(portLine.LastIndexOf(':') + 1)..]);
            var cs = $"Host=127.0.0.1;Port={port};Database=postgres;Username=itest;Password=itest";
            var server = new PostgresServer(cs, name);
            await server.WaitUntilReadyAsync();
            return server;
        }
        catch
        {
            await DockerAsync($"rm -f {name}", throwOnError: false);
            throw;
        }
    }

    /// <summary>Creates an empty database and returns its connection string.</summary>
    public async Task<string> CreateDatabaseAsync(string prefix)
    {
        var name = $"{prefix}_{Guid.NewGuid():N}"[..Math.Min(prefix.Length + 13, 63)].ToLowerInvariant();
        await using (var conn = new NpgsqlConnection(AdminConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{name}\"", conn);
            await cmd.ExecuteNonQueryAsync();
        }
        lock (_databases) _databases.Add(name);

        return new NpgsqlConnectionStringBuilder(AdminConnectionString)
        {
            Database = name,
            MaxPoolSize = 60,
        }.ConnectionString;
    }

    public async ValueTask DisposeAsync()
    {
        NpgsqlConnection.ClearAllPools();
        if (_containerName is not null)
        {
            await DockerAsync($"rm -f {_containerName}", throwOnError: false);
            return;
        }

        // Shared server: drop only what this run created.
        try
        {
            await using var conn = new NpgsqlConnection(AdminConnectionString);
            await conn.OpenAsync();
            foreach (var db in _databases)
            {
                await using var cmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{db}\" WITH (FORCE)", conn);
                await cmd.ExecuteNonQueryAsync();
            }
        }
        catch (NpgsqlException) { /* best effort */ }
    }

    private async Task WaitUntilReadyAsync()
    {
        var deadline = DateTime.UtcNow.AddSeconds(60);
        while (true)
        {
            try
            {
                await using var conn = new NpgsqlConnection(AdminConnectionString);
                await conn.OpenAsync();
                await using var cmd = new NpgsqlCommand("SELECT 1", conn);
                await cmd.ExecuteScalarAsync();
                return;
            }
            catch (Exception) when (DateTime.UtcNow < deadline)
            {
                await Task.Delay(500);
            }
        }
    }

    private static async Task<string> DockerAsync(string args, bool throwOnError = true)
    {
        var psi = new ProcessStartInfo("docker", args)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        using var process = Process.Start(psi)
            ?? throw new InvalidOperationException("Could not start the docker CLI.");
        var stdout = await process.StandardOutput.ReadToEndAsync();
        var stderr = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        if (process.ExitCode != 0 && throwOnError)
            throw new InvalidOperationException(
                $"`docker {args}` failed ({process.ExitCode}): {stderr}. " +
                $"Start Docker or set {EnvVar} to a throwaway Postgres 16 server.");
        return stdout;
    }
}
