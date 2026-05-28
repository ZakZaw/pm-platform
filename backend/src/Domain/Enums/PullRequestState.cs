namespace Domain.Enums;

/// <summary>
/// F2-23 — state of the pull request linked to a task. Maps from the
/// GitHub <c>pull_request</c> payload: an open PR is <c>Open</c>, a
/// merge flips it to <c>Merged</c> (which auto-closes the task), and a
/// close-without-merge is <c>Closed</c>.
/// </summary>
public enum PullRequestState
{
    Open = 0,
    Merged = 1,
    Closed = 2,
}
