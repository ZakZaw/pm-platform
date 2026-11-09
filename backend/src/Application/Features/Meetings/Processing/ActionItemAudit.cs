using System.Text.Json;
using Domain.Entities;

namespace Application.Features.Meetings.Processing;

/// <summary>
/// M6 - AIAuditLog rows for accepted meeting action items (AI drafts
/// turned into tasks or linked to existing ones).
/// </summary>
internal static class ActionItemAudit
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public static AIAuditLog Build(
        Guid projectId,
        Guid userId,
        Guid meetingId,
        IReadOnlyList<(Guid ActionItemId, string Title, Guid TaskId, bool LinkedExisting)> accepted)
    {
        var now = DateTime.UtcNow;
        return new AIAuditLog
        {
            ActionType = accepted.Count == 1 ? "meeting.action_item.accept" : "meeting.action_item.accept_bulk",
            ProjectId = projectId,
            UserId = userId,
            Prompt = JsonSerializer.Serialize(new { meetingId, actionItemIds = accepted.Select(a => a.ActionItemId) }, JsonOpts),
            BeforeStateJson = JsonSerializer.Serialize(
                accepted.Select(a => new { a.ActionItemId, status = "pending" }), JsonOpts),
            AfterStateJson = JsonSerializer.Serialize(
                accepted.Select(a => new
                {
                    a.ActionItemId,
                    a.Title,
                    a.TaskId,
                    outcome = a.LinkedExisting ? "linked_existing_task" : "created_task",
                }), JsonOpts),
            Provider = "n/a",
            Applied = true,
            AppliedAt = now,
        };
    }
}