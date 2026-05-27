using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// Conversation surface scoped to an org and optionally narrowed to a
/// project, team, or ad-hoc topic. F2-16 lays down the entity + auto-
/// creation hooks; message posting itself lands in F2-18 against the
/// Message entity.
///
/// At most one of <see cref="ProjectId"/>, <see cref="TeamId"/>,
/// <see cref="EpicId"/> is populated. <see cref="EpicId"/> only ever
/// sits on a Topic channel — it powers the "linked epic" badge in the
/// AC.
/// </summary>
public class Channel
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid? TeamId { get; set; }
    /// <summary>Optional pin for Topic channels. Surfaces the
    /// "linked epic" badge in the channel header.</summary>
    public Guid? EpicId { get; set; }

    public required string Name { get; set; }
    public ChannelType Type { get; set; }

    /// <summary>
    /// Bumped each time the channel sees activity (new message in
    /// F2-18, member join, rename). The Topic-inactivity sweep reads
    /// this to decide whether to archive.
    /// </summary>
    public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedByUserId { get; set; }
    public DateTime? ArchivedAt { get; set; }

    public Organization Organization { get; set; } = null!;
    public Project? Project { get; set; }
    // Team navigation intentionally omitted — the Team entity is
    // EF-ignored until the team-management feature lands. The TeamId
    // scalar is enough to materialise team channels later without a
    // schema change.
    public Epic? Epic { get; set; }
    public ICollection<ChannelMember> Members { get; set; } = [];
}
