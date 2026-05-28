using System.Text;
using Application;
using DotNetEnv;
using Infrastructure;
using Infrastructure.Hubs;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;

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
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddSignalR();

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
    });

builder.Services.AddAuthorization();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

var uploadsRoot = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "uploads");
Directory.CreateDirectory(uploadsRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = "/uploads"
});

app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapControllers();
app.MapHub<ProjectHub>("/hubs/project");

app.Run();
