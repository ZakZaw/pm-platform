namespace Application.Interfaces;

public record StoredFile(string StorageKey, string PublicUrl);

/// <summary>
/// Abstraction over blob storage. Dev uses local filesystem
/// (<c>LocalFileStorage</c>); prod can swap to S3-compatible (MinIO/S3)
/// without changing callers. The returned URL is what gets handed to the
/// browser — local dev maps it to <c>wwwroot/uploads</c> via static
/// files; an S3 driver would return a presigned or CDN URL.
/// </summary>
public interface IFileStorage
{
    Task<StoredFile> SaveAsync(
        ReadOnlyMemory<byte> content,
        string subPath,
        string fileName,
        CancellationToken cancellationToken = default);

    /// <summary>Best-effort delete; missing keys are not an error.</summary>
    Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default);
}
