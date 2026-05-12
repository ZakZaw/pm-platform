namespace Application.Common;

public class Result
{
    public bool IsSuccess { get; }
    public Error? Error { get; }

    protected Result(bool isSuccess, Error? error)
    {
        if (isSuccess && error is not null) throw new InvalidOperationException("A successful result cannot carry an error.");
        if (!isSuccess && error is null) throw new InvalidOperationException("A failed result must carry an error.");
        IsSuccess = isSuccess;
        Error = error;
    }

    public static Result Success() => new(true, null);
    public static Result Failure(Error error) => new(false, error);

    public static Result<T> Success<T>(T value) => Result<T>.Success(value);
    public static Result<T> Failure<T>(Error error) => Result<T>.Failure(error);
}

public class Result<T> : Result
{
    public T? Value { get; }

    private Result(T value) : base(true, null) { Value = value; }
    private Result(Error error) : base(false, error) { Value = default; }

    public static Result<T> Success(T value) => new(value);
    public static new Result<T> Failure(Error error) => new(error);
}

public record Error(string Code, string Message)
{
    public static readonly Error None = new(string.Empty, string.Empty);
}

public static class AuthErrors
{
    public static readonly Error EmailAlreadyRegistered =
        new("Auth.EmailAlreadyRegistered", "An account with this email already exists.");

    public static readonly Error InvalidCredentials =
        new("Auth.InvalidCredentials", "Email or password is incorrect.");

    public static readonly Error InvalidRefreshToken =
        new("Auth.InvalidRefreshToken", "The refresh token is invalid or has expired.");
}
