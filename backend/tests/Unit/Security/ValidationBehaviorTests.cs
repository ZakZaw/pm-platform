using Application.Common;
using Application.Common.Behaviors;
using Application.Features.Auth;
using Application.Features.Auth.Commands;
using FluentValidation;
using MediatR;

namespace Unit.Security;

public class ValidationBehaviorTests
{
    private static ValidationBehavior<RegisterCommand, Result<AuthResponse>> RegisterPipeline() =>
        new([new RegisterCommandValidator()]);

    [Fact]
    public async Task InvalidRequest_ShortCircuits_WithValidationFailure()
    {
        var handlerCalled = false;
        var result = await RegisterPipeline().Handle(
            new RegisterCommand("not-an-email", "short", "Al"),
            _ => { handlerCalled = true; return Task.FromResult(Result.Failure<AuthResponse>(Error.None with { Code = "x" })); },
            CancellationToken.None);

        Assert.False(handlerCalled);
        Assert.False(result.IsSuccess);
        var error = Assert.IsType<ValidationError>(result.Error);
        Assert.Equal("Validation.Failed", error.Code);
        Assert.Contains("Email", error.Errors.Keys);
        Assert.Contains("Password", error.Errors.Keys);
    }

    [Fact]
    public async Task NullEmail_IsAValidationFailure_NotACrash()
    {
        var result = await new ValidationBehavior<LoginCommand, Result<AuthResponse>>([new LoginCommandValidator()])
            .Handle(new LoginCommand(null!, "pw"), _ => throw new InvalidOperationException("handler ran"), CancellationToken.None);

        Assert.Equal("Validation.Failed", result.Error!.Code);
    }

    [Fact]
    public async Task ValidRequest_ReachesTheHandler()
    {
        var sentinel = Result.Failure<AuthResponse>(new Error("Handler.Ran", "ok"));
        var result = await RegisterPipeline().Handle(
            new RegisterCommand("ada@example.com", "correct-horse-battery", "Ada Lovelace"),
            _ => Task.FromResult(sentinel),
            CancellationToken.None);

        Assert.Same(sentinel, result);
    }

    [Fact]
    public async Task NonGenericResult_IsSupported()
    {
        var pipeline = new ValidationBehavior<Ping, Result>([new PingValidator()]);
        var result = await pipeline.Handle(new Ping(""), _ => Task.FromResult(Result.Success()), CancellationToken.None);
        Assert.Equal("Validation.Failed", result.Error!.Code);
    }

    [Fact]
    public async Task NonResultResponse_Throws()
    {
        var pipeline = new ValidationBehavior<PingRaw, string>([new PingRawValidator()]);
        await Assert.ThrowsAsync<ValidationException>(() =>
            pipeline.Handle(new PingRaw(""), _ => Task.FromResult("ran"), CancellationToken.None));
    }

    [Fact]
    public async Task NoValidators_PassesThrough()
    {
        var pipeline = new ValidationBehavior<Ping, Result>([]);
        var result = await pipeline.Handle(new Ping(""), _ => Task.FromResult(Result.Success()), CancellationToken.None);
        Assert.True(result.IsSuccess);
    }

    public sealed record Ping(string Value) : IRequest<Result>;
    private sealed class PingValidator : AbstractValidator<Ping>
    {
        public PingValidator() => RuleFor(x => x.Value).NotEmpty();
    }

    public sealed record PingRaw(string Value) : IRequest<string>;
    private sealed class PingRawValidator : AbstractValidator<PingRaw>
    {
        public PingRawValidator() => RuleFor(x => x.Value).NotEmpty();
    }
}
