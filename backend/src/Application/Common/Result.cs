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

    public static readonly Error NotAuthenticated =
        new("Auth.NotAuthenticated", "You must be signed in to perform this action.");
}

public static class OrgErrors
{
    public static readonly Error NotFound =
        new("Org.NotFound", "Organization not found.");

    public static readonly Error LogoTooLarge =
        new("Org.LogoTooLarge", "Logo file must be 2 MB or less.");

    public static readonly Error LogoInvalidType =
        new("Org.LogoInvalidType", "Logo must be a PNG, JPEG, or WebP image.");

    public static readonly Error InvalidName =
        new("Org.InvalidName", "Organization name must be 2-80 characters and contain at least one letter or digit.");

    public static readonly Error MemberNotFound =
        new("Org.MemberNotFound", "Member not found in this organization.");

    public static readonly Error InvalidRole =
        new("Org.InvalidRole", "Role must be Owner, Admin, Member, or Guest.");

    public static readonly Error CannotModifyOwner =
        new("Org.CannotModifyOwner", "Only an Owner can change another Owner's role or remove an Owner.");

    public static readonly Error CannotPromoteToOwner =
        new("Org.CannotPromoteToOwner", "Only an Owner can promote a member to Owner.");

    public static readonly Error LastOwner =
        new("Org.LastOwner", "An organization must have at least one Owner.");
}

public static class UserErrors
{
    public static readonly Error NotFound =
        new("User.NotFound", "User not found.");

    public static readonly Error InvalidFullName =
        new("User.InvalidFullName", "Full name must be 2-120 characters.");

    public static readonly Error InvalidTimezone =
        new("User.InvalidTimezone", "Timezone must be a valid IANA timezone identifier.");

    public static readonly Error InvalidCapacity =
        new("User.InvalidCapacity", "Capacity must be between 0 and 168 hours per week.");

    public static readonly Error TooManySkillTags =
        new("User.TooManySkillTags", "A user can have at most 20 skill tags.");

    public static readonly Error InvalidSkillTag =
        new("User.InvalidSkillTag", "Each skill tag must be 1-30 characters.");

    public static readonly Error AvatarTooLarge =
        new("User.AvatarTooLarge", "Avatar file must be 2 MB or less.");

    public static readonly Error AvatarInvalidType =
        new("User.AvatarInvalidType", "Avatar must be a PNG, JPEG, or WebP image.");
}

public static class InvitationErrors
{
    public static readonly Error InvalidEmail =
        new("Invitation.InvalidEmail", "A valid email address is required.");

    public static readonly Error InvalidRole =
        new("Invitation.InvalidRole", "Invitations can be sent for Admin, Member, or Guest only. Ownership is transferred separately.");

    public static readonly Error AlreadyMember =
        new("Invitation.AlreadyMember", "A user with this email is already a member of the organization.");

    public static readonly Error DuplicateActive =
        new("Invitation.DuplicateActive", "An active invitation for this email already exists.");

    public static readonly Error NotFound =
        new("Invitation.NotFound", "Invitation not found.");

    public static readonly Error Expired =
        new("Invitation.Expired", "This invitation has expired.");

    public static readonly Error AlreadyAccepted =
        new("Invitation.AlreadyAccepted", "This invitation has already been accepted.");

    public static readonly Error EmailMismatch =
        new("Invitation.EmailMismatch", "This invitation was sent to a different email address.");
}
