namespace Domain.Enums;

/// <summary>
/// Discriminator on <c>Channel</c>. Drives default membership, posting
/// rules, and which scoping foreign key is populated on the row:
/// <list type="bullet">
///   <item><b>OrgWide</b> — one per organisation, all org members are
///     implicitly subscribed; only Admin/Owner can post (F2-16 AC).</item>
///   <item><b>Project</b> — auto-created with the project, members
///     synced with project membership. Drives the default project
///     conversation surface.</item>
///   <item><b>Team</b> — same idea but scoped to a Team. Auto-created
///     when a team is created (Team commands land later).</item>
///   <item><b>Topic</b> — ad-hoc, optionally linked to an Epic. Picked
///     up by the inactivity sweep after 30 days of silence.</item>
///   <item><b>Dm</b> — direct message, 1:1 or up to 8 members. Members
///     define the channel — a 1:1 with the same pair is deduped on
///     create. No project / team / epic scoping; org-scoped only. Not
///     touched by the inactivity sweep.</item>
/// </list>
/// </summary>
public enum ChannelType
{
    OrgWide = 0,
    Project = 1,
    Team = 2,
    Topic = 3,
    Dm = 4,
}
