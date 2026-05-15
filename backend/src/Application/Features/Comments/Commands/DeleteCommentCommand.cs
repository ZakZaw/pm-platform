using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Comments.Commands;

public record DeleteCommentCommand(Guid CommentId) : IRequest<Result>;

public class DeleteCommentCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<DeleteCommentCommand, Result>
{
    public async Task<Result> Handle(DeleteCommentCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var comment = await db.Comments
            .FirstOrDefaultAsync(c => c.Id == request.CommentId, ct);
        if (comment is null)
            return Result.Failure(CommentErrors.NotFound);

        var canDelete = await CommentPermissions.CanModifyAsync(db, comment, userId, ct);
        if (!canDelete)
            return Result.Failure(CommentErrors.Forbidden);

        db.Comments.Remove(comment);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
