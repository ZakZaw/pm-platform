namespace Domain.Enums;

/// <summary>
/// F2-19 — categorisation of a scheduled meeting. Shapes default
/// agenda hints (a Retro asks for "what went well" prompts; a Standup
/// is a 15-min status check) and lets the UI filter the list.
/// </summary>
public enum MeetingType
{
    Standup = 0,
    Planning = 1,
    Review = 2,
    Retrospective = 3,
    OneOnOne = 4,
    Other = 5,
}
