using System.Reflection;
using FluentValidation;
using MediatR;

namespace Application.Common.Behaviors;

/// <summary>
/// M1 - runs every registered FluentValidation validator for a request
/// before its handler. Failures come back as a failed <see cref="Result"/>
/// carrying a <see cref="ValidationError"/> (code "Validation.Failed"), so
/// controllers turn them into a 400 problem-details response through their
/// usual ToProblem mapping; the handler never sees invalid input.
/// Requests whose response isn't a Result fall back to throwing
/// <see cref="ValidationException"/>, which the global exception handler
/// maps to a 400 validation problem.
/// </summary>
public sealed class ValidationBehavior<TRequest, TResponse>(IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        var list = validators as IValidator<TRequest>[] ?? validators.ToArray();
        if (list.Length == 0)
            return await next(ct);

        var context = new ValidationContext<TRequest>(request);
        var failures = new List<FluentValidation.Results.ValidationFailure>();
        foreach (var validator in list)
        {
            var result = await validator.ValidateAsync(context, ct);
            failures.AddRange(result.Errors.Where(e => e is not null));
        }

        if (failures.Count == 0)
            return await next(ct);

        var error = ValidationError.From(failures);
        if (FailureFactory.TryCreate(error, out var failed))
            return failed;

        throw new ValidationException(failures);
    }

    private static class FailureFactory
    {
        private static readonly Func<Error, TResponse>? Create = Build();

        public static bool TryCreate(Error error, out TResponse response)
        {
            if (Create is null)
            {
                response = default!;
                return false;
            }
            response = Create(error);
            return true;
        }

        private static Func<Error, TResponse>? Build()
        {
            var type = typeof(TResponse);
            if (type == typeof(Result))
                return e => (TResponse)(object)Result.Failure(e);

            if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Result<>))
            {
                var method = type.GetMethod(
                    nameof(Result.Failure),
                    BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly,
                    [typeof(Error)])!;
                return e => (TResponse)method.Invoke(null, [e])!;
            }

            return null;
        }
    }
}

/// <summary>A validation failure with per-property messages.</summary>
public sealed record ValidationError(IReadOnlyDictionary<string, string[]> Errors)
    : Error("Validation.Failed", Describe(Errors))
{
    public static ValidationError From(IEnumerable<FluentValidation.Results.ValidationFailure> failures) =>
        new(failures
            .GroupBy(f => f.PropertyName)
            .ToDictionary(g => g.Key, g => g.Select(f => f.ErrorMessage).Distinct().ToArray()));

    private static string Describe(IReadOnlyDictionary<string, string[]> errors) =>
        string.Join(" ", errors.SelectMany(kv => kv.Value));
}
