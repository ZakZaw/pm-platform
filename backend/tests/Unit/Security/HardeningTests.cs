using Api.Middleware;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Unit.Security;

public class ProblemDetailsExceptionHandlerTests
{
    [Fact]
    public void UnhandledError_OutsideDevelopment_HidesDetails()
    {
        var problem = ProblemDetailsExceptionHandler.Map(new InvalidOperationException("secret connection string"), isDevelopment: false);
        Assert.Equal(500, problem.Status);
        Assert.DoesNotContain("secret", problem.Detail);
        Assert.DoesNotContain(" at ", problem.Detail);
    }

    [Fact]
    public void UnhandledError_InDevelopment_IncludesDetails()
    {
        var problem = ProblemDetailsExceptionHandler.Map(new InvalidOperationException("boom"), isDevelopment: true);
        Assert.Contains("boom", problem.Detail);
    }

    [Fact]
    public void ValidationException_Is400WithFieldErrors()
    {
        var ex = new ValidationException([new ValidationFailure("Email", "Email is required.")]);
        var problem = Assert.IsType<ValidationProblemDetails>(ProblemDetailsExceptionHandler.Map(ex, false));
        Assert.Equal(400, problem.Status);
        Assert.Equal(["Email is required."], problem.Errors["Email"]);
    }

    [Fact]
    public void UniqueViolation_Is409()
    {
        var pg = new PostgresException("duplicate key", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation);
        var problem = ProblemDetailsExceptionHandler.Map(new DbUpdateException("save failed", pg), false);
        Assert.Equal(409, problem.Status);
    }
}

public class SecurityHeadersMiddlewareTests
{
    private static async Task<IHeaderDictionary> Run(string path)
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = path;
        await new SecurityHeadersMiddleware(_ => Task.CompletedTask).Invoke(ctx);
        return ctx.Response.Headers;
    }

    [Fact]
    public async Task ApiResponses_GetTheBaselineHeaders()
    {
        var h = await Run("/api/v1/tasks");
        Assert.Equal("nosniff", h["X-Content-Type-Options"]);
        Assert.Equal("DENY", h["X-Frame-Options"]);
        Assert.Equal("no-referrer", h["Referrer-Policy"]);
        Assert.Equal(SecurityHeadersMiddleware.ApiContentSecurityPolicy, h["Content-Security-Policy"]);
        Assert.Contains("frame-ancestors 'none'", h["Content-Security-Policy"].ToString());
    }

    [Fact]
    public async Task SwaggerUi_IsExemptFromTheCsp()
    {
        var h = await Run("/swagger/index.html");
        Assert.False(h.ContainsKey("Content-Security-Policy"));
        Assert.Equal("nosniff", h["X-Content-Type-Options"]);
    }

    [Fact]
    public async Task DownstreamCanOverrideTheCsp()
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = "/api/v1/attachments/x/download";
        await new SecurityHeadersMiddleware(c =>
        {
            c.Response.Headers["Content-Security-Policy"] = "sandbox; default-src 'none'";
            return Task.CompletedTask;
        }).Invoke(ctx);
        Assert.Equal("sandbox; default-src 'none'", ctx.Response.Headers["Content-Security-Policy"]);
    }
}