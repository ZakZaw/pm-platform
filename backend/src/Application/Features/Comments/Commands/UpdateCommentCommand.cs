using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Comments.Commands;

public record UpdateCommentCommand(Guid CommentId, string BodyMd)
    : IRequest<Result<CommentDto>>;

public class UpdateCommentCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<UpdateCommentCommand, Result<CommentDto>>
{
    public async Task<Result<CommentDto>> Handle(
        UpdateCommentCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<CommentDto>(AuthErrors.NotAuthenticated);

        var body = request.BodyMd?.Trim() ?? string.Empty;
        if (body.Length is < 1 or > 4000)
            return Result.Failure<CommentDto>(CommentErrors.InvalidBody);

        var comment = await db.Comments
            .FirstOrDefaultAsync(c => c.Id == request.CommentId, ct);
        if (comment is null)
            return Result.Failure<CommentDto>(CommentErrors.NotFound);

        var canEdit = await CommentPermissions.CanModifyAsync(db, comment, userId, ct);
        if (!canEdit)
            return Result.Failure<CommentDto>(CommentErrors.Forbidden);

        comment.BodyMd = body;
        comment.MentionedUserIds = MentionParser.Extract(body);
        comment.EditedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        var author = await db.Users
            .Where(u => u.Id == comment.AuthorId)
            .Select(u => new CommentAuthorDto(u.Id, u.FullName, u.AvatarUrl))
            .FirstAsync(ct);

        return Result.Success(new CommentDto(
            comment.Id, comment.TaskId, author, comment.BodyMd,
            comment.MentionedUserIds, comment.CreatedAt, comment.EditedAt));
    }
}

internal static class CommentPermissions
{
    /// <summary>
    /// The author can always modify their own comment. A project PM can
    /// moderate any comment on a task in their project.
    /// </summary>
    internal static async Task<bool> CanModifyAsync(
        IAppDbContext db, Domain.Entities.Comment comment, Guid userId, CancellationToken ct)
    {
        if (comment.AuthorId == userId) return true;

        var projectId = await db.Tasks
            .Where(t => t.Id == comment.TaskId)
            .Select(t => t.ProjectId)
            .FirstOrDefaultAsync(ct);
        if (projectId == Guid.Empty) return false;

        return await db.ProjectMemberships
            .AnyAsync(m => m.ProjectId == projectId
                            && m.UserId == userId
                            && m.Role == ProjectRole.PM, ct);
    }
}
