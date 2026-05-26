using Application.Common;
using Application.Features.Attachments.Commands;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Attachments.Queries;

public record ListTaskAttachmentsQuery(Guid TaskId)
    : IRequest<Result<IReadOnlyList<AttachmentDto>>>;

public class ListTaskAttachmentsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListTaskAttachmentsQuery, Result<IReadOnlyList<AttachmentDto>>>
{
    public async Task<Result<IReadOnlyList<AttachmentDto>>> Handle(
        ListTaskAttachmentsQuery request, CancellationToken ct)
    {
        var exists = await db.Tasks.AnyAsync(t => t.Id == request.TaskId, ct);
        if (!exists) return Result.Failure<IReadOnlyList<AttachmentDto>>(TaskErrors.NotFound);

        var rows = await db.Attachments
            .Where(a => a.TaskId == request.TaskId)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AttachmentDto(
                a.Id, a.TaskId, a.FileName, a.FileSize, a.ContentType, a.Url,
                a.UploadedByUserId, a.UploadedBy.FullName, a.CreatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<AttachmentDto>>(rows);
    }
}
