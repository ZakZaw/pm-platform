namespace Application.Features.Roadmap;

// F1.5-08 — type-aware roadmap timeline. One server-computed payload per
// project, shaped by the project's type, with a `Type` discriminator so the
// frontend roadmap registry can pick the renderer. Mirrors the per-type
// dashboard aggregates (polish D): real data, recomputed on load, no
// client-side derivation over the list endpoints.
//
// Ids are strings because a timeline mixes entity rows (Guid) with synthetic
// spans (quarter buckets, the "Sprints" lane).
//
// `Tone` is a semantic colour keyword the frontend maps to a design token:
//   accent · info · success · warning · danger · violet · teal · rose · amber ·
//   neutral · mkt-{email,social,blog,paid,event,other} (marketing channels).

/// <summary>A labelled lane. Bars and markers carry a <c>GroupId</c> pointing here.</summary>
public record TimelineGroupDto(string Id, string Label, string? Sublabel);

/// <summary>A dated span — an epic, sprint, campaign, or quarter target.</summary>
public record TimelineBarDto(
    string Id,
    string Label,
    DateTime Start,
    DateTime End,
    string Tone,
    string? Sublabel,
    string? GroupId,
    bool Flagged);

/// <summary>
/// An instant on the timeline. <see cref="Kind"/> is one of
/// <c>milestone · deal · sla · asset · run · task</c>; <see cref="Flagged"/>
/// marks the item as needing attention (overdue close, breached SLA, overdue run…).
/// </summary>
public record TimelineMarkerDto(
    string Id,
    string Label,
    DateTime At,
    string Tone,
    string Kind,
    string? Sublabel,
    string? GroupId,
    bool Flagged);

/// <summary>A headline number shown above the timeline (e.g. "Breached · 3").</summary>
public record TimelineStatDto(string Label, string Value, string Tone);

/// <summary>Work that belongs on the timeline but has no date yet.</summary>
public record TimelineUndatedDto(string Id, string Label);

/// <summary>
/// The full type-aware timeline. <see cref="From"/>/<see cref="To"/> is the
/// padded visible window; <see cref="EmptyHint"/> is shown when there is
/// nothing to plot (or as a caption explaining the shape for queue-like types).
/// </summary>
public record ProjectTimelineDto(
    Guid ProjectId,
    string Type,
    DateTime From,
    DateTime To,
    IReadOnlyList<TimelineGroupDto> Groups,
    IReadOnlyList<TimelineBarDto> Bars,
    IReadOnlyList<TimelineMarkerDto> Markers,
    IReadOnlyList<TimelineStatDto> Stats,
    IReadOnlyList<TimelineUndatedDto> Undated,
    string? EmptyHint);
