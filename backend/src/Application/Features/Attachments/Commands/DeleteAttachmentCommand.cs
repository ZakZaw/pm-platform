using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Attachments.Commands;

public record DeleteAttachmentCommand(Guid AttachmentId) : IRequest<Result>;

public class DeleteAttachmentCommandHandler(
    IAppDbContext db,
    IFileStorage fileStorage)
    : IRequestHandler<DeleteAttachmentCommand, Result>
{
    public async Task<Result> Handle(DeleteAttachmentCommand request, CancellationToken ct)
    {
        var entity = await db.Attachments.FirstOrDefaultAsync(a => a.Id == request.AttachmentId, ct);
        if (entity is null) return Result.Failure(AttachmentErrors.NotFound);

        var key = entity.StorageKey;
        db.Attachments.Remove(entity);
        await db.SaveChangesAsync(ct);
        await fileStorage.DeleteAsync(key, ct);

        return Result.Success();
    }
}
