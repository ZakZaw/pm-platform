namespace Application.Interfaces;

public record StoredFile(string StorageKey, string PublicUrl);

/// <summary>
/// Abstraction over blob storage. Dev uses local filesystem
/// (<c>LocalFileStorage</c>); prod can swap to S3-compatible (MinIO/S3)
/// without changing callers.
///
/// Two visibilities:
/// <list type="bullet">
/// <item><see cref="SaveAsync"/> - public assets (avatars, org logos):
/// the returned URL is served as a static file.</item>
/// <item><see cref="SavePrivateAsync"/> - user content that must stay
/// behind authorization (task attachments). It is never served
/// statically; read it back with <see cref="OpenReadAsync"/> from an
/// authorized endpoint.</item>
/// </list>
/// </summary>
public interface IFileStorage
{
    Task<StoredFile> SaveAsync(
        ReadOnlyMemory<byte> content,
        string subPath,
        string fileName,
        CancellationToken cancellationToken = default);

    /// <summary>Stores a file outside the statically served root. <see cref="StoredFile.PublicUrl"/> is empty.</summary>
    Task<StoredFile> SavePrivateAsync(
        ReadOnlyMemory<byte> content,
        string subPath,
        string fileName,
        CancellationToken cancellationToken = default);

    /// <summary>Opens a stored file (public or private key) for reading; null when missing.</summary>
    Task<Stream?> OpenReadAsync(string storageKey, CancellationToken cancellationToken = default);

    /// <summary>Best-effort delete; missing keys are not an error.</summary>
    Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default);
}