using Application.Interfaces;
using Infrastructure.Persistence;
using Infrastructure.Services;
using Infrastructure.Services.Ai;
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

        // AI provider: real Gemini when GEMINI_API_KEY is set, stub otherwise
        // so dev environments without a key still get a usable wizard. The
        // audit log records which provider answered, so this is traceable.
        var aiSection = configuration.GetSection("AI");
        services.Configure<AISettings>(aiSection);
        var geminiKey = aiSection["GeminiApiKey"];
        if (!string.IsNullOrWhiteSpace(geminiKey))
        {
            services.AddScoped<IAIService, GeminiAIService>();
        }
        else
        {
            services.AddScoped<IAIService, StubAIService>();
        }

        return services;
    }
}
