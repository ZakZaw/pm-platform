namespace Domain.Exceptions;

/// <summary>
/// Raised by Domain entities/value objects when a business invariant
/// would be violated. Caught at the Application boundary and mapped to
/// a Result.Failure(...) with a 4xx HTTP status. Never let one of these
/// bubble all the way up to a 500.
/// </summary>
public class DomainException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
