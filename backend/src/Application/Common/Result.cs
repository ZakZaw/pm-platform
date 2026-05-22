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

public static class ProjectErrors
{
    public static readonly Error NotFound =
        new("Project.NotFound", "Project not found.");

    public static readonly Error InvalidName =
        new("Project.InvalidName", "Project name must be 2-120 characters.");

    public static readonly Error InvalidType =
        new("Project.InvalidType", "Project type must be Engineering, Sales, Support, Marketing, Operations, or Generic.");

    public static readonly Error InvalidAIControlMode =
        new("Project.InvalidAIControlMode", "AI control mode must be Autopilot, Suggest, AskMeFirst, or Off.");

    public static readonly Error NotAMember =
        new("Project.NotAMember", "You are not a member of this project.");

    public static readonly Error InsufficientProjectRole =
        new("Project.InsufficientRole", "Your project role does not allow this action.");

    public static readonly Error InvalidProjectRole =
        new("Project.InvalidProjectRole", "Role must be PM, TeamLead, Contributor, or Viewer.");

    public static readonly Error NotOrgMember =
        new("Project.NotOrgMember", "Only members of this organisation can be added to its projects.");

    public static readonly Error AlreadyMember =
        new("Project.AlreadyMember", "This user is already a member of the project.");

    public static readonly Error MemberNotFound =
        new("Project.MemberNotFound", "Member not found on this project.");

    public static readonly Error LastPM =
        new("Project.LastPM", "A project must have at least one PM.");
}

public static class EpicErrors
{
    public static readonly Error NotFound =
        new("Epic.NotFound", "Epic not found.");

    public static readonly Error InvalidTitle =
        new("Epic.InvalidTitle", "Epic title must be 2-200 characters.");

    public static readonly Error InvalidStatus =
        new("Epic.InvalidStatus", "Epic status must be Planning, InProgress, Done, or Archived.");
}

public static class TaskErrors
{
    public static readonly Error NotFound =
        new("Task.NotFound", "Task not found.");

    public static readonly Error InvalidTitle =
        new("Task.InvalidTitle", "Task title must be 2-200 characters.");

    public static readonly Error InvalidStatus =
        new("Task.InvalidStatus", "Task status must be Backlog, ToDo, InProgress, InReview, Blocked, Done, or WontDo.");

    public static readonly Error InvalidPriority =
        new("Task.InvalidPriority", "Priority must be Low, Medium, High, or Urgent.");

    public static readonly Error InvalidStoryPoints =
        new("Task.InvalidStoryPoints", "Story points must be 0 or greater.");

    public static readonly Error EpicNotInProject =
        new("Task.EpicNotInProject", "The epic does not belong to the given project.");

    public static readonly Error SprintNotInProject =
        new("Task.SprintNotInProject", "The sprint does not belong to the given project.");

    public static readonly Error PersonalAssigneeLocked =
        new("Task.PersonalAssigneeLocked", "Tasks in your Personal project can only be assigned to you.");

    public static Error InvalidTransition(string from, string to) =>
        new("Task.InvalidTransition", $"Cannot move a task from {from} to {to}.");

    public static Error ReasonRequired(string to) =>
        new("Task.ReasonRequired", $"Moving a task to {to} requires a reason.");

    public static readonly Error NoOpTransition =
        new("Task.NoOpTransition", "Task is already in that status.");
}

public static class SubtaskErrors
{
    public static readonly Error NotFound =
        new("Subtask.NotFound", "Subtask not found.");

    public static readonly Error InvalidTitle =
        new("Subtask.InvalidTitle", "Subtask title must be 1-200 characters.");
}

public static class SprintErrors
{
    public static readonly Error NotFound =
        new("Sprint.NotFound", "Sprint not found.");

    public static readonly Error InvalidName =
        new("Sprint.InvalidName", "Sprint name must be 2-120 characters.");

    public static readonly Error InvalidDates =
        new("Sprint.InvalidDates", "Sprint end date must be after start date.");

    public static readonly Error EmptyScope =
        new("Sprint.EmptyScope", "Cannot start a sprint with zero tasks. Add tasks first.");

    public static readonly Error ActiveSprintExists =
        new("Sprint.ActiveExists", "Another sprint is already active in this project. Close it first.");

    public static readonly Error NotPlanning =
        new("Sprint.NotPlanning", "Only sprints in Planning status can be started.");

    public static readonly Error NotActive =
        new("Sprint.NotActive", "Only an Active sprint can be closed.");
}

public static class AIErrors
{
    public static readonly Error InvalidDescription =
        new("AI.InvalidDescription", "Project description must be 10-2000 characters.");

    public static readonly Error EmptyResult =
        new("AI.EmptyResult", "AI did not return any epics. Try a more descriptive prompt.");

    public static readonly Error MissingAcceptanceCriteria =
        new("AI.MissingAcceptanceCriteria", "Every story must have 2-5 acceptance criteria.");

    public static readonly Error InvalidPayload =
        new("AI.InvalidPayload", "The generation payload is missing required fields.");

    public static readonly Error RequestNotFound =
        new("AI.RequestNotFound", "AI generation request not found.");

    public static readonly Error RequestAlreadyApplied =
        new("AI.RequestAlreadyApplied", "This AI generation request has already been applied.");

    public static readonly Error ProviderFailed =
        new("AI.ProviderFailed", "The AI provider rejected or failed to answer the request.");

    public static readonly Error NotConfigured =
        new("AI.NotConfigured", "AI is not configured on the server. Set GEMINI_API_KEY in the backend environment.");

    public static readonly Error InvalidProjectName =
        new("AI.InvalidProjectName", "Project name must be 2-120 characters.");
}

public static class CommentErrors
{
    public static readonly Error NotFound =
        new("Comment.NotFound", "Comment not found.");

    public static readonly Error InvalidBody =
        new("Comment.InvalidBody", "Comment body must be 1-4000 characters.");

    public static readonly Error Forbidden =
        new("Comment.Forbidden", "Only the author or a project PM can modify this comment.");
}

public static class WorkflowErrors
{
    public static readonly Error ConfigNotFound =
        new("Workflow.ConfigNotFound", "Status configuration not found for this project.");

    public static readonly Error InvalidDisplayName =
        new("Workflow.InvalidDisplayName", "Status display name must be 1-60 characters.");

    public static readonly Error InvalidColor =
        new("Workflow.InvalidColor", "Status color must be one of neutral, info, purple, warning, danger, or success.");

    public static readonly Error InvalidReorder =
        new("Workflow.InvalidReorder", "Reorder requires a non-empty list of config ids.");

    public static readonly Error NeedOneDoneState =
        new("Workflow.NeedOneDoneState", "At least one status must be marked as a done state.");

    public static readonly Error ColumnNotEmpty =
        new("Workflow.ColumnNotEmpty", "Cannot delete a status column that still contains tasks. Move them first.");
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
