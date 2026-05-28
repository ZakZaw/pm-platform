using System.Text;
using Api.Middleware;
using Application;
using DotNetEnv;
using Infrastructure;
using Infrastructure.Auth;
using Infrastructure.Hubs;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

// Load the repo-root .env into process env so local `dotnet watch run`
// behaves like docker-compose (which reads .env natively). TraversePath
// walks up from the working directory until it finds a .env file —
// matches "backend/src/Api -> repo root" without hardcoding the depth.
Env.TraversePath().Load();

var builder = WebApplication.CreateBuilder(args);

// .env exposes GEMINI_API_KEY as a flat env var, but our config reads it
// from AI:GeminiApiKey. Bridge the two here so devs don't have to learn
// the AI__GeminiApiKey convention.
var geminiEnv = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
if (!string.IsNullOrWhiteSpace(geminiEnv))
{
    builder.Configuration["AI:GeminiApiKey"] = geminiEnv;
}

// F2-23 — GitHub OAuth App creds live as flat env vars; bridge them to
// the GitHub:* config section the adapter binds.
var ghClientId = Environment.GetEnvironmentVariable("GITHUB_CLIENT_ID");
if (!string.IsNullOrWhiteSpace(ghClientId))
{
    builder.Configuration["GitHub:ClientId"] = ghClientId;
}
var ghClientSecret = Environment.GetEnvironmentVariable("GITHUB_CLIENT_SECRET");
if (!string.IsNullOrWhiteSpace(ghClientSecret))
{
    builder.Configuration["GitHub:ClientSecret"] = ghClientSecret;
}
var ghCallbackBase = Environment.GetEnvironmentVariable("API_BASE_URL");
if (!string.IsNullOrWhiteSpace(ghCallbackBase))
{
    builder.Configuration["GitHub:CallbackBaseUrl"] = ghCallbackBase;
}

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddControllers();
builder.Services.AddHealthChecks();
builder.Services.AddSignalR();

// F2-24 — public REST API documented with Swashbuckle (Swagger UI at
// /swagger, spec at /swagger/v1/swagger.json). Advertise both auth
// schemes so the "Authorize" button works for either.
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(opt =>
{
    opt.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "PM Platform API",
        Version = "v1",
        Description = "Public REST API for the PM Platform. Authenticate with a "
            + "user Bearer JWT or an organization API key (X-Api-Key header).",
    });

    opt.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT access token.",
    });
    opt.AddSecurityDefinition("ApiKey", new OpenApiSecurityScheme
    {
        Name = ApiKeyAuthenticationHandler.HeaderName,
        Type = SecuritySchemeType.ApiKey,
        In = ParameterLocation.Header,
        Description = "Organization API key (pmk_…).",
    });
});

var jwtIssuer = builder.Configuration["Jwt:Issuer"]!;
var jwtAudience = builder.Configuration["Jwt:Audience"]!;
var jwtKey = builder.Configuration["Jwt:SigningKey"]!;

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };

        // SignalR WebSocket handshakes can't carry Authorization headers in
        // every browser, so the JS client sends the token on the query
        // string. Honor it only for paths under /hubs/.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var accessToken = ctx.Request.Query["access_token"];
                var path = ctx.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    ctx.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    })
    // F2-24 — API-key scheme as an alternative to the JWT.
    .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthenticationHandler>(
        ApiKeyAuthenticationHandler.SchemeName, null);

// Accept either a user JWT or an org API key on any [Authorize] endpoint.
builder.Services.AddAuthorization(options =>
{
    options.DefaultPolicy = new AuthorizationPolicyBuilder(
            JwtBearerDefaults.AuthenticationScheme,
            ApiKeyAuthenticationHandler.SchemeName)
        .RequireAuthenticatedUser()
        .Build();
});

var app = builder.Build();

// F2-24 — Swagger UI (/swagger) + spec (/swagger/v1/swagger.json).
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "PM Platform API v1");
    c.DocumentTitle = "PM Platform API";
});

var uploadsRoot = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "uploads");
Directory.CreateDirectory(uploadsRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = "/uploads"
});

// F2-24 — per-key rate limiting with X-RateLimit-* headers, before auth
// so it also shields unauthenticated endpoints.
app.UseMiddleware<ApiRateLimitMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapControllers();
app.MapHub<ProjectHub>("/hubs/project");

app.Run();
