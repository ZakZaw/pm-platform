using Application.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services;

public class FileStorageSettings
{
    public string PublicPath { get; set; } = "/uploads";
}

public class LocalFileStorage(
    IWebHostEnvironment env,
    IOptions<FileStorageSettings> settings)
    : IFileStorage
{
    private readonly string _root = Path.Combine(env.ContentRootPath, "wwwroot", "uploads");
    private readonly string _publicPath = settings.Value.PublicPath.TrimEnd('/');

    public async Task<StoredFile> SaveAsync(
        ReadOnlyMemory<byte> content,
        string subPath,
        string fileName,
        CancellationToken cancellationToken = default)
    {
        var safeSubPath = subPath.Trim('/', '\\');
        var dir = Path.Combine(_root, safeSubPath);
        Directory.CreateDirectory(dir);

        var fullPath = Path.Combine(dir, fileName);
        await using var fs = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None);
        await fs.WriteAsync(content, cancellationToken);

        var storageKey = $"{safeSubPath}/{fileName}".Replace('\\', '/');
        var publicUrl = $"{_publicPath}/{storageKey}";
        return new StoredFile(storageKey, publicUrl);
    }

    public Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(storageKey)) return Task.CompletedTask;

        // Defence against ".." traversal: the key must stay under _root.
        var resolved = Path.GetFullPath(Path.Combine(_root, storageKey.Replace('/', Path.DirectorySeparatorChar)));
        var rootFull = Path.GetFullPath(_root);
        if (!resolved.StartsWith(rootFull, StringComparison.OrdinalIgnoreCase))
            return Task.CompletedTask;

        try
        {
            if (File.Exists(resolved)) File.Delete(resolved);
        }
        catch (IOException) { /* best-effort */ }
        catch (UnauthorizedAccessException) { /* best-effort */ }
        return Task.CompletedTask;
    }
}
