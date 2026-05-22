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

        services.AddSingleton<IProjectEventBus, SignalRProjectEventBus>();

        // Real Gemini is the only AI provider. The constructor doesn't throw
        // when the key is missing — every call surfaces AINotConfiguredException,
        // which the AI commands map to AI.NotConfigured (503). That keeps the
        // app bootable without a key but makes the failure obvious to the user.
        services.Configure<AISettings>(configuration.GetSection("AI"));
        services.AddScoped<IAIService, GeminiAIService>();

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
