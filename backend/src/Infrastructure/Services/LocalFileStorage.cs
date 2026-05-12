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

    public async Task<string> SaveAsync(
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

        return $"{_publicPath}/{safeSubPath}/{fileName}".Replace('\\', '/');
    }
}
