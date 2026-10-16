using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Api.Middleware;

/// <summary>
/// M8 / L10 - last-resort handler for exceptions that escape a request.
/// Every unhandled error becomes an RFC 7807 <c>application/problem+json</c>
/// body. Exception messages and stack traces are only included in
/// Development; elsewhere clients get a generic message plus a trace id
/// to quote, and the details go to the log.
/// </summary>
public sealed class ProblemDetailsExceptionHandler(
    IHostEnvironment env,
    ILogger<ProblemDetailsExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken ct)
    {
        var problem = Map(exception, env.IsDevelopment());
        problem.Instance = http.Request.Path;
        problem.Extensions["traceId"] = http.TraceIdentifier;

        if (problem.Status >= 500)
            logger.LogError(exception, "Unhandled exception for {Method} {Path}", http.Request.Method, http.Request.Path);
        else
            logger.LogInformation(exception, "Request failed with {Status}: {Title}", problem.Status, problem.Title);

        http.Response.StatusCode = problem.Status ?? StatusCodes.Status500InternalServerError;
        await http.Response.WriteAsJsonAsync(problem, (System.Text.Json.JsonSerializerOptions?)null, "application/problem+json", ct);
        return true;
    }

    /// <summary>Exception → problem details. Pure, for unit tests.</summary>
    public static ProblemDetails Map(Exception exception, bool isDevelopment)
    {
        switch (exception)
        {
            case ValidationException validation:
                return new ValidationProblemDetails(validation.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).Distinct().ToArray()))
                {
                    Title = "Validation.Failed",
                    Status = StatusCodes.Status400BadRequest,
                };

            case BadHttpRequestException bad:
                return new ProblemDetails
                {
                    Title = "Request.Invalid",
                    Detail = isDevelopment ? bad.Message : "The request could not be read.",
                    Status = bad.StatusCode,
                };

            case DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } }:
                return new ProblemDetails
                {
                    Title = "Conflict",
                    Detail = "The change conflicts with existing data (it may already exist). Reload and try again.",
                    Status = StatusCodes.Status409Conflict,
                };

            case DbUpdateConcurrencyException:
                return new ProblemDetails
                {
                    Title = "Conflict",
                    Detail = "The record was changed by someone else. Reload and try again.",
                    Status = StatusCodes.Status409Conflict,
                };
        }

        return new ProblemDetails
        {
            Title = "Server.Error",
            Detail = isDevelopment ? exception.ToString() : "An unexpected error occurred.",
            Status = StatusCodes.Status500InternalServerError,
        };
    }
}