using Application.Interfaces;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Messages;

/// <summary>
/// Centralised projection from <see cref="Message"/> rows to
/// <see cref="MessageDto"/>. Pulls reactions + reply stats in two side
/// queries instead of pushing them into the main SELECT — keeps the
/// generated SQL flat and lets the channel feed and the thread view
/// share the same shape.
/// </summary>
internal static class MessageProjection
{
    public static async Task<List<MessageDto>> LoadAsync(
        IAppDbContext db, IReadOnlyList<Guid> messageIds, CancellationToken ct)
    {
        if (messageIds.Count == 0) return [];

        var rows = await db.Messages
            .Where(m => messageIds.Contains(m.Id))
            .Select(m => new
            {
                m.Id, m.ChannelId, m.ParentMessageId, m.AuthorId,
                AuthorName = m.Author.FullName,
                AuthorEmail = m.Author.Email,
                AuthorAvatarUrl = m.Author.AvatarUrl,
                m.BodyMd,
                m.CreatedAt, m.EditedAt, m.DeletedAt,
            })
            .ToListAsync(ct);

        // Reactions: pulled in one round-trip and grouped in memory so
        // we don't fire one query per message. UserIds are kept ordered
        // by reaction time so the first-reactor highlight is stable.
        var reactionRows = await db.MessageReactions
            .Where(r => messageIds.Contains(r.MessageId))
            .OrderBy(r => r.CreatedAt)
            .Select(r => new { r.MessageId, r.Emoji, r.UserId })
            .ToListAsync(ct);
        var reactionsByMessage = reactionRows
            .GroupBy(r => r.MessageId)
            .ToDictionary(
                g => g.Key,
                g => g.GroupBy(r => r.Emoji)
                    .Select(eg => new ReactionGroupDto(
                        eg.Key, eg.Count(), eg.Select(x => x.UserId).ToList()))
                    .ToList());

        // Reply counts only count rows that aren't soft-deleted, so a
        // deleted reply doesn't bump the visible count. Last-reply time
        // is the most recent reply that's still visible.
        var replyAgg = await db.Messages
            .Where(m => m.ParentMessageId != null
                     && messageIds.Contains(m.ParentMessageId!.Value)
                     && m.DeletedAt == null)
            .GroupBy(m => m.ParentMessageId!.Value)
            .Select(g => new
            {
                ParentId = g.Key,
                Count = g.Count(),
                LastAt = g.Max(m => m.CreatedAt),
            })
            .ToListAsync(ct);
        var replyByParent = replyAgg.ToDictionary(r => r.ParentId, r => (r.Count, r.LastAt));

        return rows
            .Select(r =>
            {
                replyByParent.TryGetValue(r.Id, out var rep);
                reactionsByMessage.TryGetValue(r.Id, out var reacts);
                var isDeleted = r.DeletedAt != null;
                return new MessageDto(
                    r.Id, r.ChannelId, r.ParentMessageId, r.AuthorId,
                    r.AuthorName, r.AuthorEmail, r.AuthorAvatarUrl,
                    // Don't ship the original body for soft-deleted
                    // messages — the UI renders a "(deleted)" stub.
                    isDeleted ? string.Empty : r.BodyMd,
                    r.CreatedAt,
                    r.EditedAt,
                    isDeleted,
                    rep.Count, rep.LastAt == default ? null : rep.LastAt,
                    (IReadOnlyList<ReactionGroupDto>?)reacts ?? []);
            })
            .ToList();
    }

    public static async Task<MessageDto?> LoadOneAsync(
        IAppDbContext db, Guid messageId, CancellationToken ct)
    {
        var list = await LoadAsync(db, [messageId], ct);
        return list.FirstOrDefault();
    }
}
