using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Comments.Commands;

public record CreateCommentCommand(
    Guid TaskId,
    string BodyMd,
    IReadOnlyList<Guid>? MentionedUserIds) : IRequest<Result<CommentDto>>;

public class CreateCommentCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IProjectEventBus events)
    : IRequestHandler<CreateCommentCommand, Result<CommentDto>>
{
    public async Task<Result<CommentDto>> Handle(
        CreateCommentCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<CommentDto>(AuthErrors.NotAuthenticated);

        var body = request.BodyMd?.Trim() ?? string.Empty;
        if (body.Length is < 1 or > 4000)
            return Result.Failure<CommentDto>(CommentErrors.InvalidBody);

        var task = await db.Tasks
            .Where(t => t.Id == request.TaskId)
            .Select(t => new { t.Id, t.StoryId })
            .FirstOrDefaultAsync(ct);
        if (task is null)
            return Result.Failure<CommentDto>(TaskErrors.NotFound);

        var projectId = await db.Stories
            .Where(s => s.Id == task.StoryId)
            .Select(s => s.ProjectId)
            .FirstOrDefaultAsync(ct);

        var parsed = MentionParser.Extract(body);
        var mentions = new HashSet<Guid>(parsed);
        if (request.MentionedUserIds is not null)
            foreach (var id in request.MentionedUserIds) mentions.Add(id);

        var validMentions = await FilterToOrgMembersAsync(projectId, mentions, ct);

        var comment = new Comment
        {
            TaskId = request.TaskId,
            AuthorId = userId,
            BodyMd = body,
            MentionedUserIds = validMentions,
        };
        db.Comments.Add(comment);
        await db.SaveChangesAsync(ct);

        var author = await db.Users
            .Where(u => u.Id == userId)
            .Select(u => new CommentAuthorDto(u.Id, u.FullName, u.AvatarUrl))
            .FirstAsync(ct);

        if (projectId != Guid.Empty)
        {
            await events.PublishAsync(projectId, "task.commented",
                new { taskId = task.Id, commentId = comment.Id }, ct);
        }

        return Result.Success(new CommentDto(
            comment.Id, comment.TaskId, author, comment.BodyMd,
            comment.MentionedUserIds, comment.CreatedAt, comment.EditedAt));
    }

    private async Task<Guid[]> FilterToOrgMembersAsync(
        Guid projectId, IEnumerable<Guid> userIds, CancellationToken ct)
    {
        if (projectId == Guid.Empty) return [];
        var ids = userIds.ToArray();
        if (ids.Length == 0) return [];
        var orgId = await db.Projects
            .Where(p => p.Id == projectId)
            .Select(p => p.OrganizationId)
            .FirstOrDefaultAsync(ct);
        if (orgId == Guid.Empty) return [];
        return await db.OrgMemberships
            .Where(m => m.OrganizationId == orgId
                         && m.RemovedAt == null
                         && ids.Contains(m.UserId))
            .Select(m => m.UserId)
            .ToArrayAsync(ct);
    }
}
