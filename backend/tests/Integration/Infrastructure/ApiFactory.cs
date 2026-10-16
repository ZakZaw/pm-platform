using System.Net;
using Infrastructure.Persistence;
using Infrastructure.Services;
using Infrastructure.Services.Ai;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace Integration.Infrastructure;

/// <summary>
/// The real API (Program.cs) on a TestServer, pointed at a throwaway
/// Postgres database. Test-only changes:
/// <list type="bullet">
/// <item>the DbContext is re-registered with the test connection string, so
/// nothing in .env / the environment can redirect it at a dev database;</item>
/// <item>the Gemini key is blanked (AI calls fail closed, nothing leaves the box);</item>
/// <item>background sweepers are removed;</item>
/// <item>attachments go to a temp folder;</item>
/// <item>an <c>X-Test-Client-Ip</c> header sets the connection's remote IP
/// (TestServer has none), so per-IP rate limits can be exercised.</item>
/// </list>
/// </summary>
public sealed class ApiFactory(string connectionString, IReadOnlyDictionary<string, string?>? settings = null)
    : WebApplicationFactory<Program>
{
    public const string ClientIpHeader = "X-Test-Client-Ip";

    /// <summary>Generous limits so the shared test client never trips the real ones.</summary>
    public static readonly IReadOnlyDictionary<string, string?> HighRateLimits = new Dictionary<string, string?>
    {
        ["RateLimit:PermitLimit"] = "100000",
        ["RateLimit:Auth:PermitLimit"] = "100000",
        ["RateLimit:PublicLink:PermitLimit"] = "100000",
        ["RateLimit:AI:PermitLimit"] = "100000",
    };

    public string PrivateUploadsRoot { get; } =
        Path.Combine(Path.GetTempPath(), "pmp-itest-uploads", Guid.NewGuid().ToString("N"));

    public string ConnectionString => connectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:DefaultConnection", connectionString);
        builder.UseSetting("Logging:LogLevel:Default", "Warning");
        builder.UseSetting("Logging:LogLevel:Microsoft.EntityFrameworkCore", "Error");
        foreach (var (key, value) in settings ?? HighRateLimits)
            builder.UseSetting(key, value);

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connectionString));

            services.PostConfigure<AISettings>(o => o.GeminiApiKey = null);
            services.PostConfigure<FileStorageSettings>(o => o.PrivateRoot = PrivateUploadsRoot);

            var sweepers = services
                .Where(d => d.ServiceType == typeof(IHostedService)
                    && d.ImplementationType?.Assembly == typeof(AppDbContext).Assembly)
                .ToList();
            foreach (var d in sweepers) services.Remove(d);

            services.AddSingleton<IStartupFilter, TestClientIpStartupFilter>();
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try { if (Directory.Exists(PrivateUploadsRoot)) Directory.Delete(PrivateUploadsRoot, true); }
        catch (IOException) { }
    }

    private sealed class TestClientIpStartupFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((ctx, nxt) =>
            {
                ctx.Connection.RemoteIpAddress =
                    ctx.Request.Headers.TryGetValue(ClientIpHeader, out var ip) && IPAddress.TryParse(ip, out var parsed)
                        ? parsed
                        : IPAddress.Loopback;
                return nxt(ctx);
            });
            next(app);
        };
    }
}
