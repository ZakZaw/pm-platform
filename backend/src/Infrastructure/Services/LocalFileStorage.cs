using Application.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services;

public class FileStorageSettings
{
    public string PublicPath { get; set; } = "/uploads";

    /// <summary>
    /// Directory (absolute, or relative to the content root) for private
    /// files such as task attachments. Must NOT be under wwwroot.
    /// </summary>
    public string PrivateRoot { get; set; } = "App_Data/private-uploads";
}

public class LocalFileStorage(
    IWebHostEnvironment env,
    IOptions<FileStorageSettings> settings)
    : IFileStorage
{
    /// <summary>Storage keys for private files start with this prefix.</summary>
    public const string PrivatePrefix = "private/";

    private readonly string _root = Path.Combine(env.ContentRootPath, "wwwroot", "uploads");
    private readonly string _privateRoot = Path.Combine(env.ContentRootPath, settings.Value.PrivateRoot);
    private readonly string _publicPath = settings.Value.PublicPath.TrimEnd('/');

    public async Task<StoredFile> SaveAsync(
        ReadOnlyMemory<byte> content,
        string subPath,
        string fileName,
        CancellationToken cancellationToken = default)
    {
        var storageKey = await WriteAsync(_root, content, subPath, fileName, cancellationToken);
        return new StoredFile(storageKey, $"{_publicPath}/{storageKey}");
    }

    public async Task<StoredFile> SavePrivateAsync(
        ReadOnlyMemory<byte> content,
        string subPath,
        string fileName,
        CancellationToken cancellationToken = default)
    {
        var relative = await WriteAsync(_privateRoot, content, subPath, fileName, cancellationToken);
        return new StoredFile(PrivatePrefix + relative, string.Empty);
    }

    public Task<Stream?> OpenReadAsync(string storageKey, CancellationToken cancellationToken = default)
    {
        var path = Resolve(storageKey);
        if (path is null || !File.Exists(path)) return Task.FromResult<Stream?>(null);
        Stream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
        return Task.FromResult<Stream?>(stream);
    }

    public Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default)
    {
        var resolved = Resolve(storageKey);
        if (resolved is null) return Task.CompletedTask;

        try
        {
            if (File.Exists(resolved)) File.Delete(resolved);
        }
        catch (IOException) { /* best-effort */ }
        catch (UnauthorizedAccessException) { /* best-effort */ }
        return Task.CompletedTask;
    }

    private static async Task<string> WriteAsync(
        string root, ReadOnlyMemory<byte> content, string subPath, string fileName, CancellationToken ct)
    {
        var safeSubPath = subPath.Trim('/', '\\');
        var dir = Path.Combine(root, safeSubPath);
        Directory.CreateDirectory(dir);

        var fullPath = Path.Combine(dir, fileName);
        await using var fs = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None);
        await fs.WriteAsync(content, ct);

        return $"{safeSubPath}/{fileName}".Replace('\\', '/');
    }

    /// <summary>
    /// Maps a storage key to a path, refusing anything that escapes its
    /// root (defence against ".." traversal).
    /// </summary>
    private string? Resolve(string storageKey)
    {
        if (string.IsNullOrWhiteSpace(storageKey)) return null;

        var isPrivate = storageKey.StartsWith(PrivatePrefix, StringComparison.Ordinal);
        var root = isPrivate ? _privateRoot : _root;
        var relative = isPrivate ? storageKey[PrivatePrefix.Length..] : storageKey;

        var resolved = Path.GetFullPath(Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar)));
        var rootFull = Path.GetFullPath(root) + Path.DirectorySeparatorChar;
        return resolved.StartsWith(rootFull, StringComparison.OrdinalIgnoreCase) ? resolved : null;
    }
}