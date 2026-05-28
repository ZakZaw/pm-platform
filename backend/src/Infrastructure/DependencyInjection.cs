using Application.Interfaces;
using Infrastructure.Persistence;
using Infrastructure.Services;
using Infrastructure.Services.Ai;
using Infrastructure.Services.ProjectTypes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");

        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.Configure<JwtSettings>(configuration.GetSection("Jwt"));
        services.AddSingleton<IJwtService, JwtService>();
        services.AddSingleton<IPasswordHasher, PasswordHasher>();

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, CurrentUserService>();

        services.Configure<FileStorageSettings>(configuration.GetSection("FileStorage"));
        services.AddScoped<IFileStorage, LocalFileStorage>();

        services.Configure<FrontendSettings>(configuration.GetSection("Frontend"));
        services.AddScoped<IEmailService, ConsoleEmailService>();

        // F2-19 — .ics writer is pure / state-free; singleton.
        services.AddSingleton<Application.Features.Meetings.IcsCalendarWriter>();

        // F2-20 — LiveKit video. We register even when LIVEKIT_URL is
        // blank so the rest of the app stays bootable; IsConfigured
        // gates the join endpoint.
        services.Configure<Services.Video.VideoSettings>(configuration.GetSection("Video"));
        services.AddHttpClient();
        services.AddSingleton<IVideoService, Services.Video.LiveKitVideoService>();

        // Guest-link URL builder. Resolves at request time so the
        // FrontendSettings binding has the latest value.
        services.AddScoped(sp =>
        {
            var frontend = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<FrontendSettings>>().Value;
            return new Application.Features.Meetings.Commands.GuestLinkUrlBuilder(frontend.BaseUrl);
        });

        // F2-23 — GitHub source-control integration. Registered even
        // when client creds are blank; IsConfigured gates the OAuth
        // endpoints, matching the AI / video posture.
        services.Configure<ExternalAdapters.GitHub.GitHubSettings>(configuration.GetSection("GitHub"));
        services.AddScoped<IGitHubService, ExternalAdapters.GitHub.GitHubAdapter>();
        services.AddSingleton<IOAuthStateProtector, OAuthStateProtector>();

        // F2-25 — periodic integration health probe.
        services.AddHostedService<Services.Integrations.IntegrationHealthMonitorService>();

        services.AddSingleton<IProjectEventBus, SignalRProjectEventBus>();
        services.AddScoped<IActivityRecorder, EfActivityRecorder>();
        services.AddScoped<INotificationService, EfNotificationService>();
        services.AddScoped<IAIControlGate, EfAIControlGate>();

        // Real Gemini is the only AI provider. The constructor doesn't throw
        // when the key is missing — every call surfaces AINotConfiguredException,
        // which the AI commands map to AI.NotConfigured (503). That keeps the
        // app bootable without a key but makes the failure obvious to the user.
        services.Configure<AISettings>(configuration.GetSection("AI"));
        services.AddScoped<IAIService, GeminiAIService>();

        // F2-12 — daily sweep over active sprints. The hosted service
        // scopes its own DbContext per tick, so it's safe to register
        // alongside the scoped IAIService above.
        services.AddHostedService<VelocityReplanScannerService>();

        // F2-16 — daily sweep that archives Topic channels with >30d
        // of silence.
        services.AddHostedService<Services.Channels.TopicChannelArchiveService>();

        // Phase 1.5 project-type registry. One provider per ProjectType
        // value; the registry indexes them on construction and throws if
        // any are missing — so adding a new type means adding a provider
        // class, not touching this file.
        services.AddSingleton<IProjectTypeProvider, EngineeringProjectTypeProvider>();
        services.AddSingleton<IProjectTypeProvider, SalesProjectTypeProvider>();
        services.AddSingleton<IProjectTypeProvider, SupportProjectTypeProvider>();
        services.AddSingleton<IProjectTypeProvider, MarketingProjectTypeProvider>();
        services.AddSingleton<IProjectTypeProvider, OperationsProjectTypeProvider>();
        services.AddSingleton<IProjectTypeProvider, GenericProjectTypeProvider>();
        services.AddSingleton<IProjectTypeRegistry, ProjectTypeRegistry>();

        return services;
    }
}
