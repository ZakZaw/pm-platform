using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Application.Features.Attachments;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Attachments.Commands;

public record UploadAttachmentCommand(
    Guid TaskId,
    byte[] Bytes,
    string FileName,
    string? ContentType) : IRequest<Result<AttachmentDto>>;

public record AttachmentDto(
    Guid Id,
    Guid TaskId,
    string FileName,
    long FileSize,
    string ContentType,
    string Url,
    Guid UploadedByUserId,
    string? UploadedByName,
    DateTime CreatedAt);

public class UploadAttachmentCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IFileStorage fileStorage)
    : IRequestHandler<UploadAttachmentCommand, Result<AttachmentDto>>
{
    public const int MaxBytes = 50 * 1024 * 1024;

    public async Task<Result<AttachmentDto>> Handle(UploadAttachmentCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<AttachmentDto>(AuthErrors.NotAuthenticated);

        if (request.Bytes is null || request.Bytes.Length == 0)
            return Result.Failure<AttachmentDto>(AttachmentErrors.EmptyFile);
        if (request.Bytes.Length > MaxBytes)
            return Result.Failure<AttachmentDto>(AttachmentErrors.FileTooLarge);

        var fileName = (request.FileName ?? string.Empty).Trim();
        if (fileName.Length is < 1 or > 260)
            return Result.Failure<AttachmentDto>(AttachmentErrors.InvalidFileName);
        fileName = SanitizeFileName(fileName);
        if (AttachmentFilePolicy.IsBlocked(fileName, request.ContentType))
            return Result.Failure<AttachmentDto>(AttachmentErrors.BlockedType);

        var task = await db.Tasks
            .Where(t => t.Id == request.TaskId)
            .Select(t => new { t.Id, t.ProjectId })
            .FirstOrDefaultAsync(ct);
        if (task is null) return Result.Failure<AttachmentDto>(TaskErrors.NotFound);

        // Avoid collisions on disk by prefixing a guid; keep the original
        // file name visible to the user via the entity column.
        var diskName = $"{Guid.NewGuid():N}-{fileName}";
        var contentType = NormalizeContentType(request.ContentType);
        // H3 - private storage: never reachable as a static file.
        var stored = await fileStorage.SavePrivateAsync(
            request.Bytes, $"tasks/{task.Id:N}", diskName, ct);

        var entityId = Guid.NewGuid();
        var entity = new Attachment
        {
            Id = entityId,
            TaskId = task.Id,
            FileName = fileName,
            FileSize = request.Bytes.Length,
            ContentType = contentType,
            StorageKey = stored.StorageKey,
            Url = AttachmentFilePolicy.DownloadUrl(entityId),
            UploadedByUserId = userId,
        };
        db.Attachments.Add(entity);
        await db.SaveChangesAsync(ct);

        var uploaderName = await db.Users
            .Where(u => u.Id == userId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync(ct);

        return Result.Success(new AttachmentDto(
            entity.Id, entity.TaskId, entity.FileName, entity.FileSize, entity.ContentType,
            entity.Url, entity.UploadedByUserId, uploaderName, entity.CreatedAt));
    }

    private static string SanitizeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var safe = new string(name.Select(c => invalid.Contains(c) ? '_' : c).ToArray());
        return safe.Length > 260 ? safe[..260] : safe;
    }

    private static string NormalizeContentType(string? raw)
    {
        var t = (raw ?? string.Empty).Trim();
        return string.IsNullOrEmpty(t) ? "application/octet-stream" : t;
    }
}
