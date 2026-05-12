namespace Application.Interfaces;

public interface IFileStorage
{
    Task<string> SaveAsync(
        ReadOnlyMemory<byte> content,
        string subPath,
        string fileName,
        CancellationToken cancellationToken = default);
}
