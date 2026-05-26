namespace Domain.Entities;

/// <summary>
/// A file attached to a task. Storage is abstracted behind
/// <c>IFileStorage</c> — the entity only stores metadata + a storage key
/// (opaque path the storage provider can use to fetch / delete). 50 MB
/// upload limit enforced at the command layer.
/// </summary>
public class Attachment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TaskId { get; set; }
    public required string FileName { get; set; }
    public long FileSize { get; set; }
    public required string ContentType { get; set; }
    public required string StorageKey { get; set; }
    public required string Url { get; set; }
    public Guid UploadedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Task Task { get; set; } = null!;
    public User UploadedBy { get; set; } = null!;
}
