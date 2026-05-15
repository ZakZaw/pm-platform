using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Comments.Queries;

public record ListTaskCommentsQuery(Guid TaskId)
    : IRequest<Result<IReadOnlyList<CommentDto>>>;

public class ListTaskCommentsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListTaskCommentsQuery, Result<IReadOnlyList<CommentDto>>>
{
    public async Task<Result<IReadOnlyList<CommentDto>>> Handle(
        ListTaskCommentsQuery request, CancellationToken ct)
    {
        var taskExists = await db.Tasks.AnyAsync(t => t.Id == request.TaskId, ct);
        if (!taskExists)
            return Result.Failure<IReadOnlyList<CommentDto>>(TaskErrors.NotFound);

        var rows = await db.Comments
            .Where(c => c.TaskId == request.TaskId)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new CommentDto(
                c.Id,
                c.TaskId,
                new CommentAuthorDto(c.Author.Id, c.Author.FullName, c.Author.AvatarUrl),
                c.BodyMd,
                c.MentionedUserIds,
                c.CreatedAt,
                c.EditedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<CommentDto>>(rows);
    }
}
