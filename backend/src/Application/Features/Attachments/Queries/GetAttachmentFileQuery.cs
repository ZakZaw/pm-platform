using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Attachments.Queries;

public record AttachmentFile(Stream Content, string FileName, string ContentType);

/// <summary>
/// H3 - streams an attachment for the authorized download endpoint
/// (project Viewer+, enforced by the API filter). Attachments are never
/// served as static files.
/// </summary>
public record GetAttachmentFileQuery(Guid AttachmentId) : IRequest<Result<AttachmentFile>>;

public class GetAttachmentFileQueryHandler(IAppDbContext db, IFileStorage storage)
    : IRequestHandler<GetAttachmentFileQuery, Result<AttachmentFile>>
{
    public async Task<Result<AttachmentFile>> Handle(GetAttachmentFileQuery request, CancellationToken ct)
    {
        var row = await db.Attachments
            .Where(a => a.Id == request.AttachmentId)
            .Select(a => new { a.FileName, a.ContentType, a.StorageKey })
            .FirstOrDefaultAsync(ct);
        if (row is null)
            return Result.Failure<AttachmentFile>(AttachmentErrors.NotFound);

        var stream = await storage.OpenReadAsync(row.StorageKey, ct);
        if (stream is null)
            return Result.Failure<AttachmentFile>(AttachmentErrors.NotFound);

        return Result.Success(new AttachmentFile(
            stream, row.FileName, AttachmentFilePolicy.ResponseContentType(row.ContentType)));
    }
}